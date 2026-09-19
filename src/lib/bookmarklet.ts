// Generates a per-user "sync bookmarklet" — a saved browser bookmark whose
// URL is JavaScript instead of a link. Clicking it while logged into SLCM
// captures the same attendance API response scraper/sync.js normally reads
// via Playwright, but does it inside the user's own already-authenticated
// browser tab instead — no terminal, no install, works on mobile browsers
// that support adding a bookmark with a custom URL.
//
// Mirrors scraper/sync.js's extractAttendanceList/hasValidCourseRecords/
// field-mapping logic (kept in sync manually — if sync.js's parsing logic
// changes, update the equivalent block in BOOKMARKLET_SOURCE below too).

export function generateBookmarklet(origin: string, token: string): string {
  const source = `
(function () {
  if (window.__rbSyncInstalled) {
    window.__rbSyncBanner && window.__rbSyncBanner('Already listening — now click into the Attendance section.', '#0D9488');
    return;
  }
  window.__rbSyncInstalled = true;

  var ROLLBOOK_ORIGIN = ${JSON.stringify(origin)};
  var TOKEN = ${JSON.stringify(token)};
  var best = null;

  function banner(msg, color, showCopy, copyText) {
    var el = document.getElementById('rb-sync-banner');
    if (!el) {
      el = document.createElement('div');
      el.id = 'rb-sync-banner';
      el.style.cssText = 'position:fixed;bottom:16px;right:16px;z-index:2147483647;max-width:360px;' +
        'font:13px/1.4 system-ui,sans-serif;background:#15131A;color:#F5F3FF;border:2px solid #1E293B;' +
        'border-radius:16px;padding:12px 14px;box-shadow:4px 4px 0px #0D0B12;';
      document.body.appendChild(el);
    }
    el.style.borderColor = color || '#2DD4BF';
    el.innerHTML = '<strong>Roll Book Sync</strong><br>' + msg +
      (showCopy ? '<br><textarea readonly style="width:100%;height:80px;margin-top:6px;font-size:10px;">' +
        copyText.replace(/</g, '&lt;') + '</textarea>' +
        '<button id="rb-copy-btn" style="margin-top:6px;padding:4px 10px;border-radius:8px;border:2px solid #1E293B;background:#2DD4BF;color:#15131A;font-weight:700;cursor:pointer;">Copy</button>' : '');
    if (showCopy) {
      document.getElementById('rb-copy-btn').onclick = function () {
        var ta = el.querySelector('textarea');
        ta.select();
        document.execCommand('copy');
      };
    }
  }
  window.__rbSyncBanner = banner;

  banner('Listening for attendance data… now click into the Attendance section (don\\'t refresh your browser).', '#FBBF24');

  function isValidList(list) {
    if (!Array.isArray(list) || list.length === 0) return false;
    for (var i = 0; i < list.length; i++) {
      var item = list[i];
      if (item && typeof item === 'object' && (
        item.Total_number_of_classes_attended__c !== undefined ||
        item.CourseOffering !== undefined ||
        item.Total_Classes__c !== undefined ||
        item.Course_Code__c !== undefined ||
        item.classesAttended !== undefined ||
        (item.Name && (item.present !== undefined || item.total !== undefined))
      )) return true;
    }
    return false;
  }

  function extractList(raw) {
    if (!raw) return [];
    if (typeof raw === 'string') {
      try { return extractList(JSON.parse(raw)); } catch (e) { return []; }
    }
    if (Array.isArray(raw)) {
      if (isValidList(raw)) return raw;
      for (var j = 0; j < raw.length; j++) {
        var sub = extractList(raw[j]);
        if (isValidList(sub)) return sub;
      }
      return [];
    }
    if (typeof raw === 'object') {
      var keys = ['returnValue', 'records', 'copList', 'copRecords', 'data', 'result', 'courses', 'items', 'list'];
      for (var i = 0; i < keys.length; i++) {
        if (raw[keys[i]]) {
          var extracted = extractList(raw[keys[i]]);
          if (isValidList(extracted)) return extracted;
        }
      }
      for (var k in raw) {
        var val = raw[k];
        if (val && typeof val === 'object') {
          var nested = extractList(val);
          if (isValidList(nested)) return nested;
        }
      }
    }
    return [];
  }

  function toSyncedCourses(list) {
    return list.map(function (c) {
      var co = c.CourseOffering || {};
      var lc = co.LearningCourse || {};
      var present = Number(
        c.Total_number_of_classes_attended__c != null ? c.Total_number_of_classes_attended__c :
        c.classesAttended != null ? c.classesAttended :
        c.present != null ? c.present :
        c.Attended_Classes__c != null ? c.Attended_Classes__c : 0
      );
      var total = Number(
        c.Total_Classes__c != null ? c.Total_Classes__c :
        c.totalClasses != null ? c.totalClasses :
        c.total != null ? c.total : present
      );
      var absent = Math.max(0, total - present);
      var name = lc.Name || co.Name || c.Course_Title__c || c.courseName || c.Name || c.name || 'Unknown Course';
      var code = c.Course_Code__c || co.Course_Code__c || c.courseCode || c.code || '';
      return { name: name, code: code, present: present, absent: absent };
    });
  }

  function handleCandidate(raw) {
    if (!raw) return;
    if (raw.actions && Array.isArray(raw.actions)) {
      for (var a = 0; a < raw.actions.length; a++) {
        var act = raw.actions[a];
        if (act && act.returnValue) {
          handleCandidate(act.returnValue);
        }
      }
      return;
    }
    var list = extractList(raw);
    if (isValidList(list) && (!best || list.length > best.length)) {
      best = list;
      banner('Captured ' + list.length + ' subjects. Sending to Roll Book…', '#2DD4BF');
      push();
    }
  }

  function push() {
    var courses = toSyncedCourses(best);
    fetch(ROLLBOOK_ORIGIN + '/api/sync/push', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + TOKEN },
      body: JSON.stringify({ courses: courses, syncedAt: new Date().toISOString() })
    }).then(function (res) {
      if (!res.ok) throw new Error('Request failed: ' + res.status);
      return res.json();
    }).then(function () {
      banner('✅ Synced! Refresh your Roll Book dashboard to see it.', '#34D399');
    }).catch(function (err) {
      banner('Could not send automatically (site security blocked it). Copy this and paste it into Roll Book → Settings → Sync instead:', '#FB7185', true, JSON.stringify(courses));
    });
  }

  var origFetch = window.fetch;
  window.fetch = function (input, init) {
    var url = typeof input === 'string' ? input : (input && input.url) || '';
    var method = (init && init.method) || (typeof input === 'object' && input.method) || 'GET';
    var isTarget = url.indexOf('/s/sfsites/aura') !== -1 && String(method).toUpperCase() === 'POST';
    var body = (init && init.body) || '';
    if (isTarget && String(body).indexOf('getCOPList') === -1 && String(body).indexOf('COP') === -1 && String(body).indexOf('commonLWCApexMethods') === -1) {
      isTarget = false;
    }
    return origFetch.apply(this, arguments).then(function (res) {
      if (isTarget) {
        res.clone().json().then(handleCandidate).catch(function () {});
      }
      return res;
    });
  };

  var OrigXHR = window.XMLHttpRequest;
  function PatchedXHR() {
    var xhr = new OrigXHR();
    var _url = '', _method = '';
    var origOpen = xhr.open;
    xhr.open = function (method, url) {
      _url = url; _method = method;
      return origOpen.apply(xhr, arguments);
    };
    xhr.addEventListener('load', function () {
      if (_url.indexOf('/s/sfsites/aura') !== -1 && String(_method).toUpperCase() === 'POST') {
        try {
          var json = JSON.parse(xhr.responseText);
          handleCandidate(json);
        } catch (e) {}
      }
    });
    return xhr;
  }
  window.XMLHttpRequest = PatchedXHR;
})();
`.trim()

  return `javascript:${encodeURIComponent(source)}`
}

// Generates a per-user "sync bookmarklet" or console snippet.
// Running it inside an active, already-authenticated SLCM portal tab
// captures the live Salesforce Aura attendance API responses and
// securely pushes the verified figures to Roll Book.

export function getBookmarkletSource(origin: string, token: string): string {
  return `
(function () {
  if (window.__rbSyncInstalled) {
    if (window.__rbSyncBanner) {
      window.__rbSyncBanner('Already listening! Click into another section (like Home) then click back to Attendance to trigger sync.', '#0D9488');
    }
    return;
  }
  window.__rbSyncInstalled = true;

  var ROLLBOOK_ORIGIN = ${JSON.stringify(origin)};
  var TOKEN = ${JSON.stringify(token)};
  var best = null;

  console.log('[RollBook Sync] Initializing live SLCM listener...');

  function banner(msg, color, showCopy, copyText) {
    var el = document.getElementById('rb-sync-banner');
    if (!el) {
      el = document.createElement('div');
      el.id = 'rb-sync-banner';
      el.style.cssText = 'position:fixed;bottom:20px;right:20px;z-index:2147483647;max-width:380px;width:calc(100vw - 40px);' +
        'font:13px/1.4 system-ui,-apple-system,sans-serif;background:#15131A;color:#F5F3FF;border:2px solid #2DD4BF;' +
        'border-radius:16px;padding:14px 16px;box-shadow:6px 6px 0px #0D0B12;box-sizing:border-box;';
      document.body.appendChild(el);
    }
    el.style.borderColor = color || '#2DD4BF';
    el.innerHTML = '<div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">' +
      '<span style="font-size:16px;">📖</span>' +
      '<strong style="font-size:14px;color:#2DD4BF;">Roll Book Sync</strong>' +
      '</div>' +
      '<div style="font-size:12px;line-height:1.4;margin-top:2px;">' + msg + '</div>' +
      (showCopy ? '<textarea readonly style="width:100%;height:84px;margin-top:8px;font-size:11px;font-family:monospace;background:#0D0B12;color:#2DD4BF;border:1px solid #334155;border-radius:8px;padding:6px;box-sizing:border-box;resize:none;">' +
        copyText.replace(/</g, '&lt;') + '</textarea>' +
        '<div style="margin-top:8px;display:flex;gap:8px;">' +
        '<button id="rb-copy-btn" style="padding:6px 12px;border-radius:8px;border:2px solid #0D0B12;background:#2DD4BF;color:#15131A;font-weight:bold;cursor:pointer;font-size:12px;">Copy JSON</button>' +
        '</div>' : '');

    if (showCopy) {
      var btn = document.getElementById('rb-copy-btn');
      if (btn) {
        btn.onclick = function () {
          var ta = el.querySelector('textarea');
          if (ta) {
            ta.select();
            document.execCommand('copy');
            btn.innerText = 'Copied!';
            setTimeout(function () { btn.innerText = 'Copy JSON'; }, 2000);
          }
        };
      }
    }
  }
  window.__rbSyncBanner = banner;

  banner('Listening for attendance data…<br><span style="color:#94A3B8;font-size:11px;">If already on Attendance, click another tab (like Home) then click back to Attendance to trigger capture!</span>', '#FBBF24');

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
      console.log('[RollBook Sync] Captured ' + list.length + ' subjects from SLCM:', list);
      banner('Captured ' + list.length + ' subjects! Sending to Roll Book…', '#2DD4BF');
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
      if (!res.ok) throw new Error('Request status: ' + res.status);
      return res.json();
    }).then(function (data) {
      banner('✅ Attendance synced successfully! Refresh your Roll Book tab to view your updated figures.', '#34D399');
    }).catch(function (err) {
      console.warn('[RollBook Sync] Direct push blocked by browser CSP. Showing manual copy box:', err);
      banner('Site security blocked automatic push. Click <strong>Copy JSON</strong> below, then paste into Roll Book settings:', '#FB7185', true, JSON.stringify(courses));
    });
  }

  // Hook fetch
  try {
    var origFetch = window.fetch;
    if (origFetch && !origFetch.__rbPatched) {
      var patchedFetch = function (input, init) {
        var url = typeof input === 'string' ? input : (input && input.url) || '';
        var method = (init && init.method) || (typeof input === 'object' && input.method) || 'GET';
        var isTarget = String(url).indexOf('/s/sfsites/aura') !== -1 && String(method).toUpperCase() === 'POST';
        return origFetch.apply(this, arguments).then(function (res) {
          if (isTarget) {
            try {
              res.clone().json().then(handleCandidate).catch(function () {});
            } catch (e) {}
          }
          return res;
        });
      };
      patchedFetch.__rbPatched = true;
      window.fetch = patchedFetch;
    }
  } catch (e) {
    console.warn('[RollBook Sync] Fetch hook error:', e);
  }

  // Hook XMLHttpRequest on prototype safely
  try {
    var OrigProto = window.XMLHttpRequest && window.XMLHttpRequest.prototype;
    if (OrigProto && !OrigProto.__rbPatched) {
      OrigProto.__rbPatched = true;
      var origOpen = OrigProto.open;
      var origSend = OrigProto.send;
      OrigProto.open = function (method, url) {
        this._rbUrl = String(url || '');
        this._rbMethod = String(method || '').toUpperCase();
        return origOpen.apply(this, arguments);
      };
      OrigProto.send = function () {
        var xhr = this;
        this.addEventListener('load', function () {
          if (xhr._rbUrl && xhr._rbUrl.indexOf('/s/sfsites/aura') !== -1 && xhr._rbMethod === 'POST') {
            try {
              var json = JSON.parse(xhr.responseText);
              handleCandidate(json);
            } catch (e) {}
          }
        });
        return origSend.apply(this, arguments);
      };
    }
  } catch (e) {
    console.warn('[RollBook Sync] XHR hook error:', e);
  }
})();
`.trim()
}

export function generateBookmarklet(origin: string, token: string): string {
  const source = getBookmarkletSource(origin, token)
  return `javascript:${encodeURIComponent(source)}`
}

export function generateConsoleSnippet(origin: string, token: string): string {
  return getBookmarkletSource(origin, token)
}

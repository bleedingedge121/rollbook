import { generateBookmarklet } from '../src/lib/bookmarklet'
import vm from 'vm'

async function run() {
  console.log('Testing Bookmarklet Generation...')
  const origin = 'http://localhost:3000'
  const token = 'rb_sync_test_token_12345'
  const bookmarklet = generateBookmarklet(origin, token)

  console.log('1. Starts with javascript: ?', bookmarklet.startsWith('javascript:'))
  if (!bookmarklet.startsWith('javascript:')) {
    throw new Error('Bookmarklet does not start with javascript:')
  }

  const code = decodeURIComponent(bookmarklet.replace(/^javascript:/, ''))
  console.log('2. Decoded code length:', code.length)

  // Test syntax with Node VM
  try {
    new vm.Script(code)
    console.log('3. ✓ Syntax is 100% valid JavaScript!')
  } catch (e) {
    console.error('Syntax error in bookmarklet:', e)
    process.exit(1)
  }

  // Test execution in a simulated browser context
  const fakeWindow: any = {
    fetch: () => Promise.resolve(),
    XMLHttpRequest: class FakeXHR {
      open() {}
      send() {}
      addEventListener() {}
    }
  }

  let bannerCreated = false
  let bannerMessage = ''
  const fakeDoc: any = {
    getElementById: (id: string) => (id === 'rb-sync-banner' && bannerCreated ? { style: {}, set innerHTML(val: string) { bannerMessage = val } } : null),
    createElement: () => {
      bannerCreated = true
      return {
        id: '',
        style: {},
        set innerHTML(val: string) { bannerMessage = val }
      }
    },
    body: {
      appendChild: () => {}
    }
  }

  const context = vm.createContext({
    window: fakeWindow,
    document: fakeDoc
  })

  try {
    vm.runInContext(code, context)
    console.log('4. ✓ Executed cleanly!')
    console.log('5. Banner listening message:', bannerMessage)
    console.log('6. __rbSyncInstalled:', fakeWindow.__rbSyncInstalled)
  } catch (err) {
    console.error('Execution error:', err)
    process.exit(1)
  }

  console.log('\nAll Bookmarklet JS tests PASSED! ✨')
}

run().catch((e) => {
  console.error(e)
  process.exit(1)
})

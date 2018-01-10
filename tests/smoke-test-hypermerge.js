/* global it, describe, before */

const assert = require('assert')
const ram = require('random-access-memory')
const hypermerge = require('..')
const OnlineOfflinePump = require('./lib/online-offline-pump')

function newHypermerge (storage, key) {
  const promise = new Promise((resolve, reject) => {
    const hm = hypermerge(storage, key)
    hm.on('ready', () => {
      resolve(hm)
    })
    hm.on('error', err => reject(err))
  })
  return promise
}

function connectPeer (hm, key) {
  const promise = new Promise((resolve, reject) => {
    hm.connectPeer(key, (err, peer) => {
      if (err) return reject(err)
      resolve(peer)
    })
  })
  return promise
}

describe('smoke test, hypermerge', () => {
  // https://github.com/inkandswitch/hypermerge/wiki/Smoke-Test

  let alice, bob
  let pump

  before(async () => {
    alice = await newHypermerge(ram)
    bob = await newHypermerge(ram, alice.key.toString('hex'))
    await connectPeer(alice, bob.local.key)
    pump = new OnlineOfflinePump(alice, bob)
  })

  it(`1. Alice starts with a blank canvas and is online. Bob is also ` +
      `online, has joined, but hasn't synced yet`, () => {
    pump.goOnline()

    alice.change('blank canvas', doc => {
      doc.x0y0 = 'w'
      doc.x0y1 = 'w'
      doc.x1y0 = 'w'
      doc.x1y1 = 'w'
    })
    assert.deepEqual(alice.get(), {
      _objectId: '00000000-0000-0000-0000-000000000000',
      x0y0: 'w',
      x0y1: 'w',
      x1y0: 'w',
      x1y1: 'w'
    })
  })

  it('2. Alice makes an edit', () => {
    alice.change('alice adds red pixel', doc => { doc.x0y0 = 'r' })
    assert.deepEqual(alice.get(), {
      _objectId: '00000000-0000-0000-0000-000000000000',
      x0y0: 'r',
      x0y1: 'w',
      x1y0: 'w',
      x1y1: 'w'
    })
  })

  it(`2a. Alice's edit gets synced over to Bob's canvas`, () => {
    assert.deepEqual(bob.get(), {
      _objectId: '00000000-0000-0000-0000-000000000000',
      x0y0: 'r',
      x0y1: 'w',
      x1y0: 'w',
      x1y1: 'w'
    })
    assert.deepEqual(bob.get()._conflicts, {})
  })

  it('3. Bob makes an edit', () => {
    bob.change('bob adds blue pixel', doc => { doc.x1y1 = 'b' })
    assert.deepEqual(bob.get(), {
      _objectId: '00000000-0000-0000-0000-000000000000',
      x0y0: 'r',
      x0y1: 'w',
      x1y0: 'w',
      x1y1: 'b'
    })
  })

  it(`3a. Bob's edit gets synced to Alice's canvas`, () => {
    // wait for sync to happen
    setTimeout(() => {
      assert.deepEqual(alice.get(), {
        _objectId: '00000000-0000-0000-0000-000000000000',
        x0y0: 'r',
        x0y1: 'w',
        x1y0: 'w',
        x1y1: 'b'
      })
      assert.deepEqual(alice.get()._conflicts, {})
    }, 0)
  })

  it('4. Alice and/or Bob go offline', () => {
    pump.goOffline()
  })

  it('5. Both Alice and Bob make edits while offline', () => {
    alice.change(
      'alice adds green and red pixels',
      doc => {
        doc.x1y0 = 'g'
        doc.x1y1 = 'r'
      }
    )
    bob.change(
      'bob adds green and white pixels',
      doc => {
        doc.x1y0 = 'g'
        doc.x1y1 = 'w'
      }
    )
    assert.deepEqual(alice.get(), {
      _objectId: '00000000-0000-0000-0000-000000000000',
      x0y0: 'r',
      x0y1: 'w',
      x1y0: 'g',
      x1y1: 'r'
    })
    assert.deepEqual(bob.get(), {
      _objectId: '00000000-0000-0000-0000-000000000000',
      x0y0: 'r',
      x0y1: 'w',
      x1y0: 'g',
      x1y1: 'w'
    })
  })

  it('6. Alice and Bob both go back online, and re-sync', done => {
    pump.goOnline()

    // wait for sync to happen
    setTimeout(() => {
      const aliceKey = alice.key.toString('hex')
      const bobKey = bob.local.key.toString('hex')
      if (aliceKey < bobKey) {
        // console.log('Bob wins')
        assert.deepEqual(alice.get(), {
          _objectId: '00000000-0000-0000-0000-000000000000',
          x0y0: 'r',
          x0y1: 'w',
          x1y0: 'g',
          x1y1: 'w'
        })
        assert.deepEqual(alice.get()._conflicts, {
          x1y0: {
            [aliceKey]: 'g'
          },
          x1y1: {
            [aliceKey]: 'r'
          }
        })
        assert.deepEqual(bob.get(), {
          _objectId: '00000000-0000-0000-0000-000000000000',
          x0y0: 'r',
          x0y1: 'w',
          x1y0: 'g',
          x1y1: 'w'
        })
        assert.deepEqual(bob.get()._conflicts, {
          x1y0: {
            [aliceKey]: 'g'
          },
          x1y1: {
            [aliceKey]: 'r'
          }
        })
      } else {
        // console.log('Alice wins')
        assert.deepEqual(alice.get(), {
          _objectId: '00000000-0000-0000-0000-000000000000',
          x0y0: 'r',
          x0y1: 'w',
          x1y0: 'g',
          x1y1: 'r'
        })
        assert.deepEqual(alice.get()._conflicts, {
          x1y0: {
            [bobKey]: 'g'
          },
          x1y1: {
            [bobKey]: 'w'
          }
        })
        assert.deepEqual(bob.get(), {
          _objectId: '00000000-0000-0000-0000-000000000000',
          x0y0: 'r',
          x0y1: 'w',
          x1y0: 'g',
          x1y1: 'r'
        })
        assert.deepEqual(bob.get()._conflicts, {
          x1y0: {
            [bobKey]: 'g'
          },
          x1y1: {
            [bobKey]: 'w'
          }
        })
      }
      done()
    }, 0)
  })
})

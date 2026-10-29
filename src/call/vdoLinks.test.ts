import { describe, expect, it } from 'vitest'
import { deviceParam, sendUrl, vdoAction, watchUrl } from './vdoLinks.ts'

const params = (url: string) => new URL(url).searchParams

describe('picking a device for VDO.Ninja', () => {
  it('uses the default, none, or a name with underscores for spaces', () => {
    expect(deviceParam('')).toBe('1')
    expect(deviceParam(null)).toBe('0')
    expect(deviceParam('  FaceTime HD Camera (Built-in) ')).toBe('FaceTime_HD_Camera_(Built-in)')
  })
})

describe('sending your camera', () => {
  const options = {
    cameraId: 'dnd0123456789abcdef01',
    key: 'abcdef0123456789abcdef01',
    devices: { camera: 'Logitech BRIO', microphone: '' },
    cameraOff: false,
    micOff: false,
  }

  it('starts straight away, under your camera address and the table password, with the chosen devices', () => {
    const url = sendUrl(options)
    expect(url.startsWith('https://vdo.ninja/?')).toBe(true)
    expect(params(url).get('push')).toBe('dnd0123456789abcdef01')
    expect(params(url).get('password')).toBe('abcdef0123456789abcdef01')
    expect(params(url).get('videodevice')).toBe('Logitech_BRIO')
    expect(params(url).get('audiodevice')).toBe('1')
    for (const flag of ['autostart', 'webcam', 'cleanoutput']) expect(params(url).has(flag)).toBe(true)
    expect(params(url).has('mute')).toBe(false)
    expect(params(url).has('videomute')).toBe(false)
  })

  it('can start with the microphone or camera already off', () => {
    expect(params(sendUrl({ ...options, micOff: true })).has('mute')).toBe(true)
    expect(params(sendUrl({ ...options, cameraOff: true })).has('videomute')).toBe(true)
  })

  it('turns a quiet microphone up (or a loud one down) where it is sent, from half to double', () => {
    expect(params(sendUrl(options)).has('audiogain')).toBe(false)
    expect(params(sendUrl({ ...options, devices: { ...options.devices, micLevel: 100 } })).has('audiogain')).toBe(false)
    expect(params(sendUrl({ ...options, devices: { ...options.devices, micLevel: 160 } })).get('audiogain')).toBe('160')
    expect(params(sendUrl({ ...options, devices: { ...options.devices, micLevel: 900 } })).get('audiogain')).toBe('200')
    expect(params(sendUrl({ ...options, devices: { ...options.devices, micLevel: 10 } })).get('audiogain')).toBe('50')
  })

  it('sends no video at all with no camera chosen', () => {
    expect(params(sendUrl({ ...options, devices: { camera: null, microphone: '' } })).get('videodevice')).toBe('0')
  })
})

describe('watching someone', () => {
  const options = { cameraId: 'dndfeedfacefeedface00', key: 'abcdef0123456789abcdef01', bitrate: 300 }

  it('fills the tile, at a small bitrate, with the table password', () => {
    const url = watchUrl({ ...options, sound: true })
    expect(params(url).get('view')).toBe('dndfeedfacefeedface00')
    expect(params(url).get('password')).toBe('abcdef0123456789abcdef01')
    expect(params(url).get('videobitrate')).toBe('300')
    for (const flag of ['cleanoutput', 'cover', 'transparent']) expect(params(url).has(flag)).toBe(true)
    expect(params(url).has('noaudio')).toBe(false)
  })

  it('leaves their voice out in tabs that do not play the call', () => {
    expect(params(watchUrl({ ...options, sound: false })).has('noaudio')).toBe(true)
  })
})

describe('messages from VDO.Ninja', () => {
  it('reads the action and ignores anything else', () => {
    expect(vdoAction({ action: 'seeding-started', value: true })).toBe('seeding-started')
    expect(vdoAction({ loudness: {} })).toBeNull()
    expect(vdoAction('hello')).toBeNull()
    expect(vdoAction(null)).toBeNull()
  })
})

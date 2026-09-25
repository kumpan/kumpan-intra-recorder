// One-shot: prints the apps currently recording from a microphone as a JSON array,
// e.g. ["Search"]. Title matching can't see a call in a browser that doesn't title its
// window after the tab; the mic in use can. Needs no permission: it reads Core Audio's
// process list, not audio. argv[1] is the recorder's own PID, left out so its own
// recording doesn't count.
import AppKit
import CoreAudio

let ownPid = pid_t(CommandLine.arguments.dropFirst().first ?? "") ?? getppid()

func read<T: BinaryInteger>(_ object: AudioObjectID, _ selector: AudioObjectPropertySelector, _ initial: T) -> T {
  var address = AudioObjectPropertyAddress(
    mSelector: selector,
    mScope: kAudioObjectPropertyScopeGlobal,
    mElement: kAudioObjectPropertyElementMain
  )
  var value = initial
  var size = UInt32(MemoryLayout<T>.size)
  AudioObjectGetPropertyData(object, &address, 0, nil, &size, &value)
  return value
}

func processObjects() -> [AudioObjectID] {
  let system = AudioObjectID(kAudioObjectSystemObject)
  var address = AudioObjectPropertyAddress(
    mSelector: kAudioHardwarePropertyProcessObjectList,
    mScope: kAudioObjectPropertyScopeGlobal,
    mElement: kAudioObjectPropertyElementMain
  )
  var size: UInt32 = 0
  guard AudioObjectGetPropertyDataSize(system, &address, 0, nil, &size) == noErr else { return [] }
  var ids = [AudioObjectID](repeating: 0, count: Int(size) / MemoryLayout<AudioObjectID>.size)
  guard AudioObjectGetPropertyData(system, &address, 0, nil, &size, &ids) == noErr else { return [] }
  return ids
}

func parentPid(_ pid: pid_t) -> pid_t {
  var info = kinfo_proc()
  var size = MemoryLayout<kinfo_proc>.stride
  var mib: [Int32] = [CTL_KERN, KERN_PROC, KERN_PROC_PID, pid]
  guard sysctl(&mib, 4, &info, &size, nil, 0) == 0 else { return 0 }
  return info.kp_eproc.e_ppid
}

// Browsers record through a helper process, so walk up to the app the user sees. Only
// Dock apps count: menu-bar dictation tools and system services also hold the mic, and
// none of them is a call.
func appName(_ pid: pid_t) -> String? {
  var current = pid
  while current > 1 {
    if current == ownPid { return nil }
    if let app = NSRunningApplication(processIdentifier: current),
      app.activationPolicy == .regular
    {
      return app.localizedName
    }
    current = parentPid(current)
  }
  return nil
}

var names = Set<String>()
// ponytail: the per-process list is macOS 14+; macOS 13 keeps title matching only.
if #available(macOS 14.0, *) {
  for object in processObjects() where read(object, kAudioProcessPropertyIsRunningInput, UInt32(0)) != 0 {
    if let name = appName(read(object, kAudioProcessPropertyPID, pid_t(-1))) { names.insert(name) }
  }
}
let json = try JSONSerialization.data(withJSONObject: names.sorted())
print(String(decoding: json, as: UTF8.self))

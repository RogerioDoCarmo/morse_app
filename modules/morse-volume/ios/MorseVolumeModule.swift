import AVFoundation
import ExpoModulesCore

/**
 Reads how loud the device is set to play media.

 `AVAudioSession.outputVolume` already answers as a fraction from 0 to 1, so
 unlike Android there is no maximum to divide by — iOS measures where Android
 counts notches.

 ⚠️ The session has to be ACTIVE before the reading means anything. An
 inactive session reports a stale value, which on a phone whose volume was
 changed since the app launched is worse than no reading at all: it would warn
 about a volume the user has already turned up.

 Activating is harmless here — the app is about to play a tone through this
 same session anyway — but it can fail, and a failure is reported as `nil`
 rather than as a guess. The domain treats "cannot tell" as "say nothing".
 */
public class MorseVolumeModule: Module {
  public func definition() -> ModuleDefinition {
    Name("MorseVolume")

    Function("getOutputLevel") { () -> Double? in
      let session = AVAudioSession.sharedInstance()
      do {
        try session.setActive(true, options: [])
      } catch {
        return nil
      }
      return Double(session.outputVolume)
    }
  }
}

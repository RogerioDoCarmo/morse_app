import AVFoundation
import ExpoModulesCore

/**
 Reads how loud the device is set to play media.

 `AVAudioSession.outputVolume` already answers as a fraction from 0 to 1, so
 unlike Android there is no maximum to divide by — iOS measures where Android
 counts notches.

 The session is ACTIVATED first, because an inactive one can report a value
 from before the user last moved the volume. Activating is harmless here: the
 app is about to play a tone through this same session anyway.

 ⚠️ A FAILURE TO ACTIVATE NO LONGER SILENCES THE READING. It used to return
 `nil`, and `nil` means "say nothing" all the way up — so the one warning whose
 whole job is to explain silence could itself be silenced by a session another
 app happened to be holding. A tester played messages on 0.3.4 (13) and never
 saw it; this was one of the two candidate causes, and a reading that cannot be
 distinguished from a working one is a cause nobody can rule out.

 So it answers with the volume it can see and says the reading is `stale`. The
 adapter reports that upward, which is what will settle the question next time.
 A value that may be a few seconds old is a far better basis for this warning
 than no value at all.
 */
public class MorseVolumeModule: Module {
  public func definition() -> ModuleDefinition {
    Name("MorseVolume")

    Function("getOutputLevel") { () -> [String: Any] in
      let session = AVAudioSession.sharedInstance()
      var stale = false
      do {
        try session.setActive(true, options: [])
      } catch {
        stale = true
      }
      return ["level": Double(session.outputVolume), "stale": stale]
    }
  }
}

package expo.modules.morsevolume

import android.content.Context
import android.media.AudioManager
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * Reads how loud the device is set to play media.
 *
 * `STREAM_MUSIC`, not the ring or notification stream, because that is the one
 * the app's tone actually goes out on — a phone silenced for calls but with
 * media turned up will play a Morse message perfectly well, and warning about
 * it would be wrong.
 *
 * Android reports volume in NOTCHES rather than as a fraction: a device might
 * offer 15 steps or 30, and the number alone means nothing without the maximum
 * beside it. Both are read here and divided here, so nothing above this line
 * has to know that Android counts rather than measures.
 *
 * Returns a null LEVEL rather than throwing or guessing. A device with no
 * audio service, or a maximum of zero, has not told us it is quiet — it has
 * told us nothing, and the domain treats those differently.
 *
 * ⚠️ The answer is a RECORD, `{ level, stale }`, to match iOS. Nothing here is
 * ever stale: `getStreamVolume` asks the audio service every time and there is
 * no session to activate, so this side always reports `false`. The field
 * exists so the adapter above has one shape to read on both platforms rather
 * than a branch on `Platform.OS`, which is the kind of branch that gets tested
 * on one phone.
 */
class MorseVolumeModule : Module() {
  private val context: Context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  override fun definition() = ModuleDefinition {
    Name("MorseVolume")

    Function("getOutputLevel") {
      val audio = context.getSystemService(Context.AUDIO_SERVICE) as? AudioManager
      val max = audio?.getStreamMaxVolume(AudioManager.STREAM_MUSIC) ?: 0

      // A maximum of zero would divide by nothing, and is not a quiet phone.
      val level =
        if (audio == null || max <= 0) {
          null
        } else {
          audio.getStreamVolume(AudioManager.STREAM_MUSIC).toDouble() / max.toDouble()
        }

      mapOf("level" to level, "stale" to false)
    }
  }
}

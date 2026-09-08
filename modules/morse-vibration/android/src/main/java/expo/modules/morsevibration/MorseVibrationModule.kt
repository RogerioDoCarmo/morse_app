package expo.modules.morsevibration

import android.annotation.SuppressLint
import android.content.Context
import android.media.AudioAttributes
import android.os.Build
import android.os.VibrationAttributes
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/** Full strength for a mark, on a device that can vary it. */
private const val FULL_AMPLITUDE = 255

/** `createWaveform` takes an index to loop back to; -1 means play it once. */
private const val PLAY_ONCE = -1

/**
 * Plays a Morse pattern on the vibrator, saying what the vibration is FOR.
 *
 * ⚠️ THAT SENTENCE IS THE ENTIRE REASON THIS MODULE EXISTS.
 *
 * React Native's own `Vibration` module — and expo-haptics, and everything
 * else in the dependency tree — calls the one-argument overload:
 *
 *     v.vibrate(VibrationEffect.createWaveform(timings, repeat))
 *
 * A vibration with no stated usage is `USAGE_UNKNOWN`, and Android applies the
 * user's TOUCH-FEEDBACK intensity to it. With that turned down the platform
 * drops the vibration silently — no exception, no log, nothing for the app to
 * catch. A Poco X5 5G felt nothing at all through three builds while the same
 * code buzzed correctly on an iPhone, and the pattern handed to the OS was
 * verified right at every speed the app offers.
 *
 * `USAGE_ALARM` is the honest label. This is not touch feedback: the user
 * pressed Emit and asked for a message to be sent on the motor, the same way
 * they might ask for it on the speaker. It is also the usage the platform will
 * not quietly scale to nothing.
 *
 * Everything here is best effort and reports whether it managed anything, so
 * the adapter can fall back to `Vibration` rather than leave the message
 * unsent.
 */
@SuppressLint("MissingPermission")
class MorseVibrationModule : Module() {
  private val context: Context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  private val vibrator: Vibrator?
    get() =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
          (context.getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as? VibratorManager)
              ?.defaultVibrator
        } else {
          @Suppress("DEPRECATION")
          context.getSystemService(Context.VIBRATOR_SERVICE) as? Vibrator
        }

  override fun definition() = ModuleDefinition {
    Name("MorseVibration")

    /**
     * The pattern is Android's own form: a delay, then alternating buzz and
     * silence. Returns false when this device has nothing to play it on, or
     * when there is nothing to play — the caller then has something to fall
     * back to instead of a silence it cannot tell from success.
     */
    Function("vibratePattern") { pattern: List<Double> ->
      val device = vibrator
      val timings = LongArray(pattern.size) { pattern[it].coerceAtLeast(0.0).toLong() }

      when {
        device == null || !device.hasVibrator() -> false
        // `createWaveform` rejects an empty array and one that is all zeroes.
        timings.isEmpty() || timings.none { it > 0L } -> false
        else -> {
          play(device, timings)
          true
        }
      }
    }

    Function("cancelVibration") { vibrator?.cancel() }
  }

  private fun play(device: Vibrator, timings: LongArray) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
      @Suppress("DEPRECATION") device.vibrate(timings, PLAY_ONCE, alarmAudioAttributes())
      return
    }

    val effect =
        if (device.hasAmplitudeControl()) {
          // Even entries are the silences and odd entries the marks, because
          // the pattern opens with the delay before the first one.
          val amplitudes = IntArray(timings.size) { if (it % 2 == 0) 0 else FULL_AMPLITUDE }
          VibrationEffect.createWaveform(timings, amplitudes, PLAY_ONCE)
        } else {
          VibrationEffect.createWaveform(timings, PLAY_ONCE)
        }

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
      device.vibrate(
          effect,
          VibrationAttributes.Builder().setUsage(VibrationAttributes.USAGE_ALARM).build(),
      )
    } else {
      // `VibrationAttributes` only arrived in Android 13. Before that the same
      // thing is said with audio attributes, which the vibrator overload has
      // taken since Android 8.
      device.vibrate(effect, alarmAudioAttributes())
    }
  }

  private fun alarmAudioAttributes(): AudioAttributes =
      AudioAttributes.Builder()
          .setUsage(AudioAttributes.USAGE_ALARM)
          .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
          .build()
}

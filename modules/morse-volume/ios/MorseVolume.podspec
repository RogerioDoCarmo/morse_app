Pod::Spec.new do |s|
  s.name           = 'MorseVolume'
  s.version        = '0.1.0'
  s.summary        = 'Reads the device media output level.'
  s.description    = 'Local module: reports how loud the device is set to play media, so the app can say why a message cannot be heard.'
  s.license        = 'MIT'
  s.author         = 'Rogerio do Carmo'
  s.homepage       = 'https://github.com/RogerioDoCarmo/morse_app'
  # Matches ios/Podfile, which takes 16.4 unless Podfile.properties overrides
  # it. A module asking for MORE than the app targets fails `pod install`.
  s.platforms      = { :ios => '16.4' }
  s.swift_version  = '5.9'
  s.source         = { git: 'https://github.com/RogerioDoCarmo/morse_app.git' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.source_files = "**/*.{h,m,swift}"
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }
end

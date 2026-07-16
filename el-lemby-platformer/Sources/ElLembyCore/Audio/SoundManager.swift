import AVFoundation
import Foundation

/// Plays the generated chiptune WAVs (tools/generate_sfx.py). One
/// AVAudioPlayer per effect is enough for the MVP; the music track loops
/// forever until stopped.
final class SoundManager {
    static let shared = SoundManager()

    enum Effect: String, CaseIterable {
        case jump, coin, stomp, hurt, powerup, bump, win, gameover
    }

    private(set) var isMuted = false
    private var effectPlayers: [String: AVAudioPlayer] = [:]
    private var musicPlayer: AVAudioPlayer?

    init() {}

    func preload() {
        for effect in Effect.allCases {
            _ = player(for: effect)
        }
    }

    func play(_ effect: Effect) {
        guard !isMuted, let player = player(for: effect) else { return }
        player.currentTime = 0
        player.play()
    }

    func startMusic() {
        if isMuted { return }
        if let existing = musicPlayer {
            if !existing.isPlaying {
                existing.play()
            }
            return
        }
        guard let url = Bundle.module.url(forResource: "harah_loop",
                                          withExtension: "wav",
                                          subdirectory: "Resources/music"),
              let player = try? AVAudioPlayer(contentsOf: url) else { return }
        player.numberOfLoops = -1
        player.volume = 0.5
        player.play()
        musicPlayer = player
    }

    func stopMusic() {
        musicPlayer?.stop()
        musicPlayer = nil
    }

    func toggleMute() {
        isMuted.toggle()
        if isMuted {
            musicPlayer?.pause()
        } else {
            if musicPlayer == nil {
                startMusic()
            } else {
                musicPlayer?.play()
            }
        }
    }

    private func player(for effect: Effect) -> AVAudioPlayer? {
        if let cached = effectPlayers[effect.rawValue] {
            return cached
        }
        guard let url = Bundle.module.url(forResource: effect.rawValue,
                                          withExtension: "wav",
                                          subdirectory: "Resources/sfx"),
              let player = try? AVAudioPlayer(contentsOf: url) else {
            return nil
        }
        player.prepareToPlay()
        effectPlayers[effect.rawValue] = player
        return player
    }
}

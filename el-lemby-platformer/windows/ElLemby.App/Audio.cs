using System.Runtime.InteropServices;
using System.Text;

namespace ElLemby.App;

/// <summary>
/// Dependency-free audio through the classic winmm MCI interface. Each WAV
/// gets its own alias (so effects and music mix), opened with the mpegvideo
/// device, which supports `play … repeat` and per-alias volume — the same
/// "one player per effect" behavior as the macOS build.
/// </summary>
internal static class Audio
{
    [DllImport("winmm.dll", CharSet = CharSet.Unicode)]
    private static extern int mciSendString(string command, StringBuilder? returnValue,
                                            int returnLength, IntPtr callback);

    private static readonly bool Supported = OperatingSystem.IsWindows();
    private static readonly HashSet<string> Open = new();
    private static bool _musicStarted;

    internal static bool Muted { get; private set; }

    private static void Mci(string command)
    {
        if (Supported)
        {
            _ = mciSendString(command, null, 0, IntPtr.Zero);
        }
    }

    private static bool Ensure(string alias, string path)
    {
        if (Open.Contains(alias))
        {
            return true;
        }
        if (!File.Exists(path))
        {
            return false;
        }
        Mci($"open \"{path}\" type mpegvideo alias {alias}");
        Open.Add(alias);
        return true;
    }

    internal static void Preload()
    {
        foreach (string name in new[] { "jump", "coin", "stomp", "hurt", "powerup", "bump", "win", "gameover", "checkpoint" })
        {
            _ = Ensure("sfx_" + name, Assets.SfxPath(name));
        }
    }

    internal static void Play(string effect)
    {
        if (Muted || !Ensure("sfx_" + effect, Assets.SfxPath(effect)))
        {
            return;
        }
        Mci($"play sfx_{effect} from 0");
    }

    internal static void StartMusic()
    {
        if (Muted)
        {
            return;
        }
        if (!Ensure("music", Assets.MusicPath))
        {
            return;
        }
        if (!_musicStarted)
        {
            Mci("setaudio music volume to 500");
            _musicStarted = true;
        }
        Mci("play music repeat");
    }

    internal static void StopMusic()
    {
        if (_musicStarted)
        {
            Mci("stop music");
            Mci("seek music to start");
        }
    }

    internal static void PauseMusic() => Mci("pause music");

    internal static void ResumeMusic()
    {
        if (!Muted && _musicStarted)
        {
            Mci("play music repeat");
        }
    }

    internal static void ToggleMute()
    {
        Muted = !Muted;
        if (Muted)
        {
            PauseMusic();
        }
        else
        {
            StartMusic();
        }
    }

    internal static void Shutdown()
    {
        foreach (string alias in Open)
        {
            Mci($"close {alias}");
        }
        Open.Clear();
    }
}

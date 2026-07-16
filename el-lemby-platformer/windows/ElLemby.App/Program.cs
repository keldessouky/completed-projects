using System.Runtime.InteropServices;

namespace ElLemby.App;

internal static class Program
{
    [DllImport("winmm.dll")]
    private static extern uint timeBeginPeriod(uint ms);

    [DllImport("winmm.dll")]
    private static extern uint timeEndPeriod(uint ms);

    [STAThread]
    private static void Main()
    {
        Application.SetHighDpiMode(HighDpiMode.SystemAware);
        Application.EnableVisualStyles();
        Application.SetCompatibleTextRenderingDefault(false);

        // 1ms timer resolution so the fixed-step loop can sleep politely.
        _ = timeBeginPeriod(1);
        try
        {
            Application.Run(new GameForm());
        }
        finally
        {
            _ = timeEndPeriod(1);
            Audio.Shutdown();
        }
    }
}

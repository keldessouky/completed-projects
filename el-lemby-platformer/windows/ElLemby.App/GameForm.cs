using System.Diagnostics;
using System.Drawing.Drawing2D;
using System.Runtime.InteropServices;
using ElLemby.Core;

namespace ElLemby.App;

internal interface IScene
{
    void Update(double dt, double now);
    void Render(Graphics g, double now);
    void KeyPressed(Keys key, double now);
    void KeyReleased(Keys key, double now);
}

internal interface ISceneHost
{
    void Switch(IScene scene);
    bool IsDown(Keys key);
    GameState State { get; }
}

/// <summary>
/// The game window: a 480×272 backbuffer scaled up with nearest-neighbor
/// (letterboxed on resize) and a fixed 60Hz update loop driven off
/// Application.Idle + PeekMessage — the classic WinForms game loop.
/// </summary>
internal sealed class GameForm : Form, ISceneHost
{
    private const double StepSeconds = 1.0 / 60.0;

    private readonly Bitmap _backBuffer = new(GameConfig.SceneWidth, GameConfig.SceneHeight);
    private readonly Stopwatch _clock = Stopwatch.StartNew();
    private readonly HashSet<Keys> _pressed = new();

    private IScene _scene;
    private double _lastTick;
    private double _accumulator;
    private double _simNow;

    public GameState State { get; }

    public GameForm()
    {
        Text = L10n.WindowTitle;
        ClientSize = new Size(GameConfig.SceneWidth * GameConfig.DefaultWindowScale,
                              GameConfig.SceneHeight * GameConfig.DefaultWindowScale);
        MinimumSize = SizeFromClientSize(new Size(GameConfig.SceneWidth, GameConfig.SceneHeight));
        StartPosition = FormStartPosition.CenterScreen;
        KeyPreview = true;
        SetStyle(ControlStyles.AllPaintingInWmPaint
                 | ControlStyles.UserPaint
                 | ControlStyles.OptimizedDoubleBuffer
                 | ControlStyles.ResizeRedraw, true);

        try
        {
            Icon = Icon.ExtractAssociatedIcon(Application.ExecutablePath);
        }
        catch (Exception e) when (e is IOException or ArgumentException) { }

        string highScorePath = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
            "ElLemby", "highscore.txt");
        State = new GameState(highScorePath);

        _scene = new TitleScene(this);
        Application.Idle += OnApplicationIdle;
    }

    // ------------------------------------------------------------------
    // Scene host
    // ------------------------------------------------------------------

    public void Switch(IScene scene) => _scene = scene;

    public bool IsDown(Keys key) => _pressed.Contains(key);

    // ------------------------------------------------------------------
    // Game loop
    // ------------------------------------------------------------------

    [StructLayout(LayoutKind.Sequential)]
    private struct NativeMessage
    {
        public IntPtr Handle;
        public uint Message;
        public IntPtr WParam;
        public IntPtr LParam;
        public uint Time;
        public Point Location;
    }

    [DllImport("user32.dll")]
    private static extern bool PeekMessage(out NativeMessage message, IntPtr handle,
                                           uint filterMin, uint filterMax, uint remove);

    private void OnApplicationIdle(object? sender, EventArgs e)
    {
        while (!PeekMessage(out _, IntPtr.Zero, 0, 0, 0))
        {
            Tick();
        }
    }

    private void Tick()
    {
        double t = _clock.Elapsed.TotalSeconds;
        double frame = Math.Min(t - _lastTick, 0.1);
        _lastTick = t;
        _accumulator += frame;

        bool stepped = false;
        while (_accumulator >= StepSeconds)
        {
            _accumulator -= StepSeconds;
            _simNow += StepSeconds;
            _scene.Update(StepSeconds, _simNow);
            stepped = true;
        }

        if (stepped)
        {
            Invalidate();
        }
        else
        {
            Thread.Sleep(1);
        }
    }

    // ------------------------------------------------------------------
    // Rendering
    // ------------------------------------------------------------------

    protected override void OnPaint(PaintEventArgs e)
    {
        using (Graphics g = Graphics.FromImage(_backBuffer))
        {
            Draw.Configure(g);
            _scene.Render(g, _simNow);
        }

        Graphics screen = e.Graphics;
        screen.InterpolationMode = InterpolationMode.NearestNeighbor;
        screen.PixelOffsetMode = PixelOffsetMode.Half;

        // Aspect-fit letterbox, like the macOS build.
        double scale = Math.Min(ClientSize.Width / (double)GameConfig.SceneWidth,
                                ClientSize.Height / (double)GameConfig.SceneHeight);
        int w = (int)(GameConfig.SceneWidth * scale);
        int h = (int)(GameConfig.SceneHeight * scale);
        int x = (ClientSize.Width - w) / 2;
        int y = (ClientSize.Height - h) / 2;

        screen.Clear(Color.Black);
        screen.DrawImage(_backBuffer, new Rectangle(x, y, w, h));
    }

    // ------------------------------------------------------------------
    // Input — raw key codes, so Arabic keyboard layouts behave identically
    // ------------------------------------------------------------------

    protected override bool IsInputKey(Keys keyData)
    {
        Keys key = keyData & Keys.KeyCode;
        return key is Keys.Left or Keys.Right or Keys.Up or Keys.Down or Keys.Space
            || base.IsInputKey(keyData);
    }

    protected override void OnKeyDown(KeyEventArgs e)
    {
        base.OnKeyDown(e);
        if (!_pressed.Add(e.KeyCode))
        {
            return;   // auto-repeat
        }
        _scene.KeyPressed(e.KeyCode, _simNow);
        e.Handled = true;
    }

    protected override void OnKeyUp(KeyEventArgs e)
    {
        base.OnKeyUp(e);
        _pressed.Remove(e.KeyCode);
        _scene.KeyReleased(e.KeyCode, _simNow);
        e.Handled = true;
    }

    protected override void Dispose(bool disposing)
    {
        if (disposing)
        {
            Application.Idle -= OnApplicationIdle;
            _backBuffer.Dispose();
        }
        base.Dispose(disposing);
    }
}

namespace ElLemby.Core;

/// <summary>
/// Tuning constants — kept numerically identical to the macOS build
/// (Sources/ElLembyCore/Core/GameConfig.swift) so both platforms play the
/// same. Units are points and seconds; world Y is up.
/// </summary>
public static class GameConfig
{
    public const double TileSize = 16;
    public const int SceneWidth = 480;
    public const int SceneHeight = 272;
    public const int DefaultWindowScale = 2;

    // -9.8 m/s² at SpriteKit's 150 points per meter.
    public const double GravityPointsPerSecond = -9.8 * 150;
    public const double MaxFallSpeed = 700;

    public const double MaxRunSpeed = 116;
    public const double RunAcceleration = 640;
    public const double GroundFriction = 820;
    public const double AirAcceleration = 470;
    public const double JumpSpeed = 452;
    public const double JumpCutSpeed = 145;
    public const double StompBounceSpeed = 310;
    public const double CoyoteTime = 0.09;
    public const double JumpBufferTime = 0.12;
    public const double HurtInvulnerabilityTime = 1.6;
    public const double StompVelocityThreshold = -30;

    public const double ThugSpeed = 34;

    public const int StartLives = 3;
    public const int StageCount = 2;
    public const int StageTimeSeconds = 240;
    public const int CoinScore = 100;
    public const int StompScore = 200;
    public const int PowerUpScore = 400;
    public const int TimeBonusPerSecond = 10;

    public const double CameraLerp = 0.18;
    public const double ParallaxFar = 0.15;
    public const double ParallaxNear = 0.30;

    public const double FallDeathY = -40;
}

/// <summary>Per-frame input snapshot handed to the simulation.</summary>
public struct InputState
{
    public double MoveX;          // -1, 0, or 1
    public bool JumpHeld;
    public double JumpPressedAt;  // timestamp; consumed by the sim on jump

    public static InputState Empty => new() { JumpPressedAt = double.NegativeInfinity };
}

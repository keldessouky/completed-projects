// swift-tools-version:5.9
import PackageDescription

let package = Package(
    name: "ElLemby",
    platforms: [
        .macOS(.v13)
    ],
    targets: [
        .target(
            name: "ElLembyCore",
            path: "Sources/ElLembyCore",
            resources: [
                .copy("Resources")
            ]
        ),
        .executableTarget(
            name: "ElLemby",
            dependencies: ["ElLembyCore"],
            path: "Sources/ElLemby"
        ),
        .testTarget(
            name: "ElLembyTests",
            dependencies: ["ElLembyCore"],
            path: "Tests/ElLembyTests"
        ),
    ]
)

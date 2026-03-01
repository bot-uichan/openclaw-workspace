{
  description = "OpenClaw isolated runtime (Node 22 + voice deps)";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-24.11";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, flake-utils }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = import nixpkgs { inherit system; };
      in {
        devShells.default = pkgs.mkShell {
          packages = with pkgs; [
            nodejs_22
            ffmpeg
            python3
            pkg-config
            libopus
            gcc
            gnumake
            git
          ];

          shellHook = ''
            export OPENCLAW_NIX_ENV=1
            echo "OpenClaw Nix shell ready"
            echo "Node:    $(node -v)"
            echo "npm:     $(npm -v)"
            echo "ffmpeg:  $(ffmpeg -version | head -n1)"
            echo "python:  $(python3 --version)"
          '';
        };
      });
}

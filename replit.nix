{ pkgs }: {
  deps = [
    pkgs.nodejs_18
    pkgs.nodePackages.npm
    pkgs.yarn
  ];
}
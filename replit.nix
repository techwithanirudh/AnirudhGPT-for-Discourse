{ pkgs }: {
	deps = [
		pkgs.gh
  pkgs.code-server
  pkgs.wget
  pkgs.nodejs-18_x
    pkgs.nodePackages.typescript-language-server
    pkgs.yarn
    pkgs.replitPackages.jest
	];
}
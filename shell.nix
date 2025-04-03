{
  pkgs ? import <nixpkgs> { },
}:
pkgs.callPackage (
  {
    mkShell,
    yarn,
    nodejs_23,
    pkg-config,
    openssl,
  }:
  mkShell {
    strictDeps = true;
    # host/target agnostic programs
    depsBuildBuild = [

    ];
    # compilers & linkers & dependecy finding programs
    nativeBuildInputs = [
      yarn
      nodejs_23
      openssl
    ];
    # libraries
    buildInputs = [
      openssl
    ];
    # commands to run on entering the development shell
    shellHook =''
        yarn install
        ([ -f key.pem ] || [ -f cert.pem ]) || openssl req -x509 -newkey rsa:4096 -keyout key.pem -out cert.pem -sha256 -days 3650 -nodes -subj "/C=XX/ST=StateName/L=CityName/O=CompanyName/OU=CompanySectionName/CN=CommonNameOrHostname"
    '';
  }
) { }

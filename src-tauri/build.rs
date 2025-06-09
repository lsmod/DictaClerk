fn main() {
    // Run tauri build first
    tauri_build::build();

    // Tell cargo to link the system ogg and vorbis libraries.
    println!("cargo:rustc-link-lib=ogg");
    println!("cargo:rustc-link-lib=vorbis");
    println!("cargo:rustc-link-lib=vorbisenc");

    // Tell cargo to invalidate the built crate whenever any of these files change
    println!("cargo:rerun-if-changed=src/audio/");
}

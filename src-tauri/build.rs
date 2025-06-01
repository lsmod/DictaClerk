fn main() {
    // Run tauri build first
    tauri_build::build();
    
    // Tell cargo to link the system ogg and opus libraries.
    println!("cargo:rustc-link-lib=ogg");
    println!("cargo:rustc-link-lib=opus");
    
    // Tell cargo to invalidate the built crate whenever any of these files change
    println!("cargo:rerun-if-changed=src/audio/");
}

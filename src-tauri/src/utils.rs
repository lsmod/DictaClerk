use std::path::PathBuf;

/// Get OS-standard configuration directory
pub fn get_os_config_dir() -> PathBuf {
    #[cfg(target_os = "linux")]
    return dirs::config_dir()
        .unwrap_or_else(|| dirs::home_dir().unwrap_or_else(|| PathBuf::from(".")))
        .join("DictaClerk");

    #[cfg(target_os = "windows")]
    return dirs::config_dir()
        .unwrap_or_else(|| dirs::home_dir().unwrap_or_else(|| PathBuf::from(".")))
        .join("DictaClerk");

    #[cfg(target_os = "macos")]
    return dirs::config_dir()
        .unwrap_or_else(|| dirs::home_dir().unwrap_or_else(|| PathBuf::from(".")))
        .join("DictaClerk");

    #[cfg(not(any(target_os = "linux", target_os = "windows", target_os = "macos")))]
    return PathBuf::from(".").join("DictaClerk");
}

/// Ensure configuration directory exists
pub fn ensure_config_directory() -> Result<PathBuf, std::io::Error> {
    let config_dir = get_os_config_dir();
    if !config_dir.exists() {
        std::fs::create_dir_all(&config_dir)?;
    }
    Ok(config_dir)
}

/// Find the target path for a config file
pub fn find_config_file_path(filename: &str) -> Option<PathBuf> {
    // New priority order: OS config dir first, then current directory as fallback
    let os_config_path = get_os_config_dir().join(filename);
    let fallback_path = PathBuf::from(filename);

    let possible_paths = vec![
        os_config_path.clone(), // OS config dir (PRIMARY)
        fallback_path.clone(),  // Current dir (FALLBACK)
    ];

    // Look for existing files first
    for path in &possible_paths {
        if path.exists() {
            return Some(path.clone());
        }
    }

    // If no existing files found, prefer OS config directory for new files
    // But check if we can write to it
    if ensure_config_directory().is_ok() {
        Some(os_config_path)
    } else {
        eprintln!("⚠️  Cannot write to OS config directory, using current directory fallback");
        Some(fallback_path)
    }
}

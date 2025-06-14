//! System Tray service for DictaClerk
//!
//! This service manages the system tray icon and provides window management
//! functionality including:
//! - System tray icon with context menu
//! - Window hiding/showing
//! - Position persistence
//! - Integration with global shortcuts
//! - Startup notifications

use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Emitter, Manager, WebviewWindow,
};
use thiserror::Error;
use tokio::sync::Mutex;

/// Error types for system tray operations
#[derive(Error, Debug)]
pub enum SystemTrayError {
    #[error("Failed to create tray icon: {0}")]
    TrayCreationFailed(String),
    #[error("Failed to update tray: {0}")]
    TrayUpdateFailed(String),
    #[error("Window not found: {0}")]
    WindowNotFound(String),
    #[error("Failed to manage window: {0}")]
    WindowManagementFailed(String),
    #[error("Position persistence error: {0}")]
    PositionPersistenceError(String),
    #[error("Menu creation error: {0}")]
    MenuCreationError(String),
    #[error("Tauri error: {0}")]
    TauriError(#[from] tauri::Error),
}

/// Result type for system tray operations
pub type SystemTrayResult<T> = Result<T, SystemTrayError>;

/// Window position and size data for persistence
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WindowState {
    pub x: i32,
    pub y: i32,
    pub width: u32,
    pub height: u32,
    pub is_maximized: bool,
}

impl Default for WindowState {
    fn default() -> Self {
        Self {
            x: 100,
            y: 100,
            width: 800,
            height: 600,
            is_maximized: false,
        }
    }
}

/// Configuration for the system tray
#[derive(Debug, Clone)]
pub struct SystemTrayConfig {
    /// Show startup notification
    pub show_startup_notification: bool,
    /// Global shortcut text for notification
    pub global_shortcut: String,
    /// Enable window position persistence
    pub persist_window_position: bool,
    /// First launch behavior
    pub is_first_launch: bool,
}

impl Default for SystemTrayConfig {
    fn default() -> Self {
        Self {
            show_startup_notification: true,
            global_shortcut: "CmdOrCtrl+Shift+F9".to_string(),
            persist_window_position: true,
            is_first_launch: false,
        }
    }
}

/// System Tray service for managing tray icon and window state
pub struct SystemTrayService {
    /// Tauri app handle
    app_handle: AppHandle,
    /// Configuration
    config: SystemTrayConfig,
    /// Current window state
    window_state: Arc<Mutex<WindowState>>,
    /// Whether window is currently hidden
    is_window_hidden: Arc<Mutex<bool>>,
}

impl SystemTrayService {
    /// Create a new SystemTrayService instance
    pub fn new(app_handle: AppHandle, config: SystemTrayConfig) -> Self {
        Self {
            app_handle,
            config,
            window_state: Arc::new(Mutex::new(WindowState::default())),
            is_window_hidden: Arc::new(Mutex::new(false)),
        }
    }

    /// Get the app data directory for storing files
    fn get_app_data_dir(&self) -> Result<std::path::PathBuf, SystemTrayError> {
        // Try to get the app local data directory using Tauri's path API
        match self.app_handle.path().app_local_data_dir() {
            Ok(dir) => {
                // Ensure the directory exists
                if let Err(e) = std::fs::create_dir_all(&dir) {
                    eprintln!("Warning: Failed to create app data directory: {}", e);
                }
                Ok(dir)
            }
            Err(_) => {
                // Fallback: try to find settings.json location or use current directory
                let settings_paths = vec![
                    std::path::PathBuf::from("settings.json"),
                    std::path::PathBuf::from("../settings.json"),
                    std::path::PathBuf::from("../../settings.json"),
                ];

                for path in &settings_paths {
                    if path.exists() {
                        if let Some(parent) = path.parent() {
                            return Ok(parent.to_path_buf());
                        }
                    }
                }

                // Last resort: use current directory but only in release mode
                #[cfg(debug_assertions)]
                {
                    // In development, avoid using current directory which might be src-tauri
                    // Use temp directory or home directory instead
                    if let Ok(home_dir) = std::env::var("HOME") {
                        let app_dir = std::path::PathBuf::from(home_dir).join(".dicta-clerk");
                        if let Err(e) = std::fs::create_dir_all(&app_dir) {
                            eprintln!("Warning: Failed to create home app directory: {}", e);
                        }
                        Ok(app_dir)
                    } else {
                        // Use temp directory as last resort
                        Ok(std::env::temp_dir().join("dicta-clerk"))
                    }
                }

                #[cfg(not(debug_assertions))]
                {
                    Ok(std::path::PathBuf::from("."))
                }
            }
        }
    }

    /// Get the path for window state file
    fn get_window_state_path(&self) -> Result<std::path::PathBuf, SystemTrayError> {
        let app_dir = self.get_app_data_dir()?;
        Ok(app_dir.join("window_state.json"))
    }

    /// Initialize the system tray
    pub async fn initialize(&self) -> SystemTrayResult<()> {
        // Create tray icon
        self.create_tray_icon().await?;

        // Handle first launch vs normal startup
        if self.config.is_first_launch {
            // On first launch, show settings window instead of hiding
            self.show_settings_window().await?;
        } else {
            // Normal startup: hide main window and show notification
            self.hide_main_window().await?;

            if self.config.show_startup_notification {
                self.show_startup_notification().await?;
            }
        }

        Ok(())
    }

    /// Create the system tray icon with context menu
    async fn create_tray_icon(&self) -> SystemTrayResult<()> {
        // Create menu items
        let show_hide = MenuItem::with_id(
            &self.app_handle,
            "show_hide",
            "Show/Hide",
            true,
            None::<&str>,
        )?;
        let separator = PredefinedMenuItem::separator(&self.app_handle)?;
        let quit = MenuItem::with_id(&self.app_handle, "quit", "Quit", true, None::<&str>)?;

        // Create menu
        let menu = Menu::with_items(&self.app_handle, &[&show_hide, &separator, &quit])?;

        // Clone app handle for the event handler
        let app_handle_clone = self.app_handle.clone();
        let service_self = self.clone();

        // Create tray icon
        let _tray = TrayIconBuilder::with_id("main-tray")
            .tooltip("DictaClerk")
            .menu(&menu)
            .on_menu_event(move |_app, event| {
                let service = service_self.clone();
                tauri::async_runtime::spawn(async move {
                    if let Err(e) = service.handle_menu_event(event.id.as_ref()).await {
                        eprintln!("Failed to handle menu event: {}", e);
                    }
                });
            })
            .on_tray_icon_event(move |_tray, event| {
                let app_handle = app_handle_clone.clone();

                match event {
                    TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } => {
                        // Left click toggles window visibility
                        if let Some(window) = app_handle.get_webview_window("main") {
                            let _ = if window.is_visible().unwrap_or(false) {
                                window.hide()
                            } else {
                                window.show().and_then(|_| window.set_focus())
                            };
                        }
                    }
                    TrayIconEvent::DoubleClick {
                        button: MouseButton::Left,
                        ..
                    } => {
                        // Double click shows window and starts recording
                        // Emit event that frontend can listen to and route through proper commands
                        if let Err(e) = app_handle.emit("tray_double_click_show_and_record", ()) {
                            eprintln!("Failed to emit tray double click event: {}", e);
                        }
                    }
                    _ => {}
                }
            })
            .build(&self.app_handle)?;

        Ok(())
    }

    /// Handle tray menu events
    pub async fn handle_menu_event(&self, event_id: &str) -> SystemTrayResult<()> {
        match event_id {
            "show_hide" => {
                self.toggle_main_window().await?;
            }
            "quit" => {
                self.quit_application().await?;
            }
            _ => {}
        }
        Ok(())
    }

    /// Show startup notification
    async fn show_startup_notification(&self) -> SystemTrayResult<()> {
        // Emit system notification for UI only (not stateful)
        if let Err(e) = self.app_handle.emit(
            "system_notification",
            format!(
                "DictaClerk running - press {} to start",
                self.config.global_shortcut
            ),
        ) {
            eprintln!("Failed to emit startup notification: {}", e);
        }
        Ok(())
    }

    /// Hide the main window and save its position
    pub async fn hide_main_window(&self) -> SystemTrayResult<()> {
        if let Some(window) = self.app_handle.get_webview_window("main") {
            // Save current position before hiding
            if self.config.persist_window_position {
                self.save_window_position(&window).await?;
            }

            // Hide the window
            window
                .hide()
                .map_err(|e| SystemTrayError::WindowManagementFailed(format!("{}", e)))?;

            // Update hidden state
            let mut hidden_guard = self.is_window_hidden.lock().await;
            *hidden_guard = true;

            // Process window hide event through state machine instead of direct emission
            // The state machine will handle stopping recording if needed
            // This should be handled by the main window hide command that routes through state machine
        }
        Ok(())
    }

    /// Show the main window and restore its position
    pub async fn show_main_window(&self) -> SystemTrayResult<()> {
        if let Some(window) = self.app_handle.get_webview_window("main") {
            // Restore position if persistence is enabled
            if self.config.persist_window_position {
                self.restore_window_position(&window).await?;
            }

            // Show and focus the window
            window
                .show()
                .map_err(|e| SystemTrayError::WindowManagementFailed(format!("{}", e)))?;

            window
                .set_focus()
                .map_err(|e| SystemTrayError::WindowManagementFailed(format!("{}", e)))?;

            // Update hidden state
            let mut hidden_guard = self.is_window_hidden.lock().await;
            *hidden_guard = false;
        }
        Ok(())
    }

    /// Toggle main window visibility
    pub async fn toggle_main_window(&self) -> SystemTrayResult<()> {
        let is_hidden = *self.is_window_hidden.lock().await;

        if is_hidden {
            self.show_main_window().await?;
        } else {
            self.hide_main_window().await?;
        }

        Ok(())
    }

    /// Show window and start recording (called by global shortcut when hidden)
    pub async fn show_window_and_start_recording(&self) -> SystemTrayResult<()> {
        // Show the window first
        self.show_main_window().await?;

        // This event should be routed through the state machine instead of direct emission
        // The frontend should listen to state machine events for recording state changes
        // TODO: This needs to be called through the proper command that routes to state machine

        Ok(())
    }

    /// Show settings window (for first launch)
    async fn show_settings_window(&self) -> SystemTrayResult<()> {
        // This should be routed through the state machine command instead of direct emission
        // Use the open_settings_window command which routes through state machine
        // TODO: Call crate::commands::open_settings_window() here
        Ok(())
    }

    /// Handle window close event (minimize to tray instead of exiting)
    pub async fn handle_window_close_event(&self) -> SystemTrayResult<()> {
        self.hide_main_window().await?;
        Ok(())
    }

    /// Save current window position and state
    async fn save_window_position(&self, window: &WebviewWindow) -> SystemTrayResult<()> {
        if let (Ok(position), Ok(size)) = (window.outer_position(), window.outer_size()) {
            let window_state = WindowState {
                x: position.x,
                y: position.y,
                width: size.width,
                height: size.height,
                is_maximized: window.is_maximized().unwrap_or(false),
            };

            // Store in memory
            let mut state_guard = self.window_state.lock().await;
            *state_guard = window_state.clone();

            // Persist to file system (optional - could be settings.json)
            self.persist_window_state(&window_state).await?;
        }
        Ok(())
    }

    /// Restore window position and state
    async fn restore_window_position(&self, window: &WebviewWindow) -> SystemTrayResult<()> {
        // Load from persistence first
        if let Ok(persisted_state) = self.load_persisted_window_state().await {
            let mut state_guard = self.window_state.lock().await;
            *state_guard = persisted_state;
        }

        let state = self.window_state.lock().await.clone();

        // Check if this is a borderless window by checking its decorations
        let is_borderless = !window.is_decorated().unwrap_or(true);

        if is_borderless {
            // For borderless windows, only restore position, not size or maximized state
            if let Err(e) = window.set_position(tauri::PhysicalPosition::new(state.x, state.y)) {
                eprintln!("Failed to restore borderless window position: {}", e);
            }
        } else {
            // For normal windows, restore everything
            // Restore position and size
            if let Err(e) = window.set_position(tauri::PhysicalPosition::new(state.x, state.y)) {
                eprintln!("Failed to restore window position: {}", e);
            }

            if let Err(e) = window.set_size(tauri::PhysicalSize::new(state.width, state.height)) {
                eprintln!("Failed to restore window size: {}", e);
            }

            // Restore maximized state
            if state.is_maximized {
                if let Err(e) = window.maximize() {
                    eprintln!("Failed to maximize window: {}", e);
                }
            }
        }

        Ok(())
    }

    /// Persist window state to file system
    async fn persist_window_state(&self, state: &WindowState) -> SystemTrayResult<()> {
        let window_state_path = self.get_window_state_path()?;

        let state_json = serde_json::to_string_pretty(state).map_err(|e| {
            SystemTrayError::PositionPersistenceError(format!("JSON serialization error: {}", e))
        })?;

        tokio::fs::write(&window_state_path, state_json)
            .await
            .map_err(|e| {
                SystemTrayError::PositionPersistenceError(format!(
                    "Failed to write to {}: {}",
                    window_state_path.display(),
                    e
                ))
            })?;

        println!("Window state saved to: {}", window_state_path.display());
        Ok(())
    }

    /// Load persisted window state from file system
    async fn load_persisted_window_state(&self) -> SystemTrayResult<WindowState> {
        let window_state_path = self.get_window_state_path()?;

        let content = tokio::fs::read_to_string(&window_state_path)
            .await
            .map_err(|e| {
                SystemTrayError::PositionPersistenceError(format!(
                    "Failed to read from {}: {}",
                    window_state_path.display(),
                    e
                ))
            })?;

        let state: WindowState = serde_json::from_str(&content).map_err(|e| {
            SystemTrayError::PositionPersistenceError(format!("JSON parsing error: {}", e))
        })?;

        println!("Window state loaded from: {}", window_state_path.display());
        Ok(state)
    }

    /// Check if window is currently hidden
    pub async fn is_window_hidden(&self) -> bool {
        *self.is_window_hidden.lock().await
    }

    /// Update the global shortcut configuration
    pub async fn update_global_shortcut(&mut self, new_shortcut: String) {
        self.config.global_shortcut = new_shortcut;
    }

    /// Quit the application
    async fn quit_application(&self) -> SystemTrayResult<()> {
        self.app_handle.exit(0);
        Ok(())
    }

    /// Update tray tooltip with current status
    pub async fn update_tray_status(&self, status: &str) -> SystemTrayResult<()> {
        // Note: In Tauri 2.x, updating tray tooltip requires reconstructing the tray
        // For now, we'll just log the status update
        println!("Tray status: {}", status);
        Ok(())
    }
}

// Implement Clone for SystemTrayService to enable sharing between event handlers
impl Clone for SystemTrayService {
    fn clone(&self) -> Self {
        Self {
            app_handle: self.app_handle.clone(),
            config: self.config.clone(),
            window_state: self.window_state.clone(),
            is_window_hidden: self.is_window_hidden.clone(),
        }
    }
}

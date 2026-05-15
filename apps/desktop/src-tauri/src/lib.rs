use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};

    tauri::Builder::default()
        .plugin(tauri_plugin_notification::init())
        .setup(|app| {
            TrayIconBuilder::with_id("timer-stacks")
                .tooltip("Timer Stacks")
                .title("")
                .show_menu_on_left_click(false)
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        let app = tray.app_handle();
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                })
                .build(app)?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![update_tray_timer])
        .run(tauri::generate_context!())
        .expect("error while running Timer Stacks");
}

#[tauri::command]
fn update_tray_timer(app: tauri::AppHandle, label: Option<String>) -> Result<(), String> {
    let Some(tray) = app.tray_by_id("timer-stacks") else {
        return Ok(());
    };

    let trimmed = label
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty());
    let title = trimmed.map(|value| format!("Timer {value}"));
    let tooltip = trimmed
        .map(|value| format!("Timer Stacks - {value} remaining"))
        .unwrap_or_else(|| "Timer Stacks".to_string());

    tray
        .set_title(title.as_deref())
        .map_err(|error| error.to_string())?;
    tray
        .set_tooltip(Some(tooltip))
        .map_err(|error| error.to_string())?;

    Ok(())
}

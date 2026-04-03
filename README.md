<p align="center">
  <img src="https://img.shields.io/badge/Firmware-v1.0.0-blue" alt="Firmware">
  <img src="https://img.shields.io/badge/Backend-v1.0.0-green" alt="Backend">
  <img src="https://img.shields.io/badge/Dashboard-v1.0.0-orange" alt="Dashboard">
  <img src="https://img.shields.io/badge/Lisensi-Private-red" alt="License">
</p>

<h1 align="center">☀️ PLTS SmartHome</h1>
<h3 align="center">Sistem Monitoring & Kontrol Tenaga Surya</h3>
<p align="center">
  <strong>Tanggal:</strong> April 2025 &nbsp;|&nbsp; <strong>Lisensi:</strong> Private — Penggunaan pribadi
</p>

---

## 📑 Daftar Isi

- [1. Gambaran Umum Sistem](#1-gambaran-umum-sistem)
  - [Fitur Utama](#fitur-utama)
- [2. Arsitektur Sistem](#2-arsitektur-sistem)
  - [Alur Data](#alur-data)
- [3. Komponen Perangkat Keras (Hardware)](#3-komponen-perangkat-keras-hardware)
  - [Daftar Komponen](#daftar-komponen)
  - [Wiring Diagram I2C](#wiring-diagram-i2c)
- [4. Pemetaan GPIO ESP32](#4-pemetaan-gpio-esp32)
  - [Tabel Pin GPIO Lengkap](#tabel-pin-gpio-lengkap)
  - [Perhatian Penting](#perhatian-penting)
- [5. Struktur File Proyek](#5-struktur-file-proyek)
- [6. Instalasi & Setup](#6-instalasi--setup)
  - [6.1 Google Apps Script Backend](#61-google-apps-script-backend)
  - [6.2 Web Dashboard (PWA)](#62-web-dashboard-pwa)
  - [6.3 ESP32 Firmware (Arduino IDE)](#63-esp32-firmware-arduino-ide)
- [7. Konfigurasi](#7-konfigurasi)
  - [7.1 Config_.gs — Backend](#71-config_-gs--backend)
  - [7.2 config.h — ESP32 Firmware](#72-configh--esp32-firmware)
  - [7.3 WiFi Credentials](#73-wifi-credentials)
- [8. Referensi API](#8-referensi-api)
  - [8.1 Endpoint Publik](#81-endpoint-publik)
  - [8.2 Endpoint Autentikasi](#82-endpoint-autentikasi)
  - [8.3 Endpoint Sensor Data](#83-endpoint-sensor-data)
  - [8.4 Endpoint Kontrol Perangkat](#84-endpoint-kontrol-perangkat)
  - [8.5 Endpoint Rules Engine](#85-endpoint-rules-engine)
  - [8.6 Endpoint Manajemen User](#86-endpoint-manasemen-user)
  - [8.7 Endpoint Device (ESP32)](#87-endpoint-device-esp32)
  - [8.8 Endpoint Logging & Config](#88-endpoint-logging--config)
- [9. Spesifikasi Sensor](#9-spesifikasi-sensor)
  - [9.1 INA219 — Output MPPT](#91-ina219--output-mppt)
  - [9.2 ADS1115 — Monitoring Sel Baterai](#92-ads1115--monitoring-sel-baterai)
  - [9.3 ACS712-30A — Arus AC Beban](#93-acs712-30a--arus-ac-beban)
  - [9.4 SHT31 — Suhu & Kelembaban](#94-sht31--suhu--kelembaban)
  - [9.5 PIR — Deteksi Gerakan](#95-pir--deteksi-gerakan)
- [10. Sistem Baterai 8S LiFePO4](#10-sistem-baterai-8s-lifepo4)
  - [Spesifikasi Pack](#spesifikasi-pack)
  - [Threshold SOC (State of Charge)](#threshold-soc-state-of-charge)
  - [Perhitungan SOC](#perhitungan-soc)
- [11. Sistem Kontrol Relay](#11-sistem-kontrol-relay)
  - [Konfigurasi 74HC595 Shift Register](#konfigurasi-74hc595-shift-register)
  - [Mapping Relay](#mapping-relay)
  - [Sifat Relay Active-LOW](#sifat-relay-active-low)
  - [Safety Mechanism](#safety-mechanism)
- [12. Sistem Otomasi (Rules Engine)](#12-sistem-otomasi-rules-engine)
  - [Konsep](#konsep)
  - [Struktur Rule](#struktur-rule)
  - [Contoh Rule](#contoh-rule)
  - [Trigger Types](#trigger-types)
  - [Evaluasi Rules](#evaluasi-rules)
- [13. Web Dashboard (PWA)](#13-web-dashboard-pwa)
  - [Fitur Dashboard](#fitur-dashboard)
  - [Halaman](#halaman)
  - [Teknologi Frontend](#teknologi-frontend)
- [14. Perintah Serial ESP32](#14-perintah-serial-esp32)
- [15. Status LED Pattern](#15-status-led-pattern)
- [16. Troubleshooting](#16-troubleshooting)
- [17. Statistik Proyek](#17-statistik-proyek)
  - [Ringkasan Kode](#ringkasan-kode)
  - [Breakdown Firmware ESP32](#breakdown-firmware-esp32)
  - [Google Sheets Layout](#google-sheets-layout)
  - [Catatan Penting](#catatan-penting)

---

## 1. Gambaran Umum Sistem

**PLTS SmartHome** adalah sistem terintegrasi untuk *monitoring* dan *kontrol* Pembangkit Listrik Tenaga Surya (PLTS) yang dikombinasikan dengan fitur SmartHome. Sistem ini dirancang untuk rumah tinggal dengan kebutuhan energi yang didukung oleh panel surya dan baterai LiFePO4 8S.

Sistem terdiri dari tiga komponen utama yang saling terhubung:

| # | Komponen | Deskripsi |
|---|----------|-----------|
| 1 | **ESP32 Firmware** | Controller perangkat keras yang membaca sensor, mengontrol relay, dan berkomunikasi dengan server backend |
| 2 | **Google Apps Script (GAS) Backend** | Server middleware yang menyimpan data di Google Sheets, menangani autentikasi, dan menyediakan REST API |
| 3 | **Web Dashboard (PWA)** | Antarmuka pengguna berbasis web yang dapat di-install sebagai aplikasi mobile, untuk monitoring real-time dan kontrol perangkat |

### Fitur Utama

| Fitur | Deskripsi |
|-------|-----------|
| 📊 **Monitoring Real-time** | Data sensor diperbarui setiap 60 detik ke dashboard |
| 🔌 **Kontrol 13 Relay** | Nyala/matikan perangkat rumah tangga dari jarak jauh |
| 💡 **PWM Dimming** | Kontrol kecerahan lampu (Lampu Kamar Fatimah) secara analog |
| ☀️ **PV Disconnect** | Putuskan hubungan panel surya secara remote |
| 🔋 **Monitoring Baterai 8S** | Tegangan setiap sel LiFePO4 dipantau individual |
| 🚶 **Deteksi Gerakan (PIR)** | 4 sensor PIR untuk otomasi pencahayaan |
| ⚙️ **Rules Engine** | Otomasi berbasis kondisi sensor (baterai rendah, suhu, waktu) |
| 👥 **Manajemen User** | 3 level akses: admin, technician, user |
| 💾 **Data Logging Lokal** | Backup data sensor ke SD card |
| 📴 **Offline Mode** | ESP32 tetap berjalan lokal meski tanpa koneksi internet |
| 📱 **PWA Dashboard** | Install sebagai aplikasi di HP, akses offline untuk view terakhir |
| 🔔 **Notifikasi Event** | Log event penting (alarm, relay, sensor) |

---

## 2. Arsitektur Sistem

```
┌─────────────────────────────────────────────────────────────────┐
│                    GOOGLE SHEETS (Database)                     │
│  ┌──────────────┐ ┌──────────────┐ ┌────────────┐ ┌──────────┐ │
│  │ sensor_data  │ │ relay_status │ │  user_db   │ │config    │ │
│  │  (10080 max) │ │              │ │ session_db  │ │          │ │
│  └──────────────┘ └──────────────┘ └────────────┘ └──────────┘ │
│  ┌──────────────────┐ ┌──────────────┐                        │
│  │ automation_rules │ │  event_log   │                        │
│  └──────────────────┘ └──────────────┘                        │
└──────────────────────────┬──────────────────────────────────────┘
                           │ Google Sheets API
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│               GOOGLE APPS SCRIPT (Backend)                      │
│  ┌──────────┐ ┌────────────┐ ┌──────────────┐ ┌─────────────┐ │
│  │ Code.gs  │ │  Auth.gs   │ │ SensorData   │ │ Relay       │ │
│  │ (Router) │ │ (JWT Auth) │ │    .gs       │ │ Commands.gs │ │
│  └──────────┘ └────────────┘ └──────────────┘ └─────────────┘ │
│  ┌──────────┐ ┌────────────┐ ┌──────────────┐ ┌─────────────┐ │
│  │Config_.gs│ │ UserManager│ │ RulesEngine  │ │ PIRConfig   │ │
│  │          │ │    .gs     │ │    .gs       │ │    .gs      │ │
│  └──────────┘ └────────────┘ └──────────────┘ └─────────────┘ │
│  ┌──────────┐ ┌────────────┐                                  │
│  │ Database │ │ EventLog   │                                  │
│  │   .gs    │ │    .gs     │                                  │
│  └──────────┘ └────────────┘                                  │
└──────────┬──────────────────────────────┬──────────────────────┘
           │ HTTPS POST (Long Poll 12s)   │ HTTPS POST (Browser)
           ▼                              ▼
┌──────────────────────────┐  ┌───────────────────────────────────┐
│     ESP32 FIRMWARE       │  │       WEB DASHBOARD (PWA)         │
│  ┌────────────────────┐  │  │  ┌───────────────────────────────┐│
│  │   WiFi Manager     │  │  │  │ index.html (Login)            ││
│  │   API Client       │◄─┼──┼──│ dashboard.html (Main)         ││
│  │   Sensor Manager   │  │  │  │ css/style.css                 ││
│  │   ├─ INA219        │  │  │  │ js/auth.js                    ││
│  │   ├─ ADS1115 x2    │  │  │  │ js/api.js                     ││
│  │   ├─ ACS712        │  │  │  │ js/dashboard.js               ││
│  │   ├─ SHT31         │  │  │  │ js/controls.js                ││
│  │   └─ PIR x4        │  │  │  │ js/rules-editor.js            ││
│  │   Shift Register   │  │  │  │ js/admin.js                   ││
│  │   Relay Manager    │  │  │  │ js/pwa.js                     ││
│  │   PWM Controller   │  │  │  │ sw.js                         ││
│  │   Rules Engine     │  │  │  │ manifest.json                 ││
│  │   Command Handler  │  │  │  └───────────────────────────────┘│
│  │   SD Logger        │  │  └───────────────────────────────────┘
│  │   Watchdog Timer   │  │
│  └────────────────────┘  │
└──────────────────────────┘
```

### Alur Data

1. **ESP32 membaca sensor** (INA219, ADS1115, ACS712, SHT31, PIR) setiap **5 detik**
2. **ESP32 upload data** ke GAS Backend setiap **60 detik** via HTTPS POST
3. **ESP32 long-poll** ke GAS Backend setiap **12 detik** untuk menerima perintah
4. **GAS menyimpan data** di Google Sheets (`sensor_data`, `relay_status`, `event_log`)
5. **Dashboard** mengambil data dari GAS Backend saat dibuka
6. **Dashboard** mengirim perintah kontrol relay/PWM ke GAS Backend
7. **ESP32 menerima perintah** melalui long-poll dan mengeksekusi kontrol hardware

---

## 3. Komponen Perangkat Keras (Hardware)

### Daftar Komponen

| Komponen | Jumlah | Fungsi |
|----------|:------:|--------|
| ESP32 Dev Module | 1 | Mikrokontroler utama (240 MHz, 4MB Flash, 520KB SRAM) |
| Panel Surya + MPPT | 1 | Pembangkit listrik tenaga surya |
| Baterai LiFePO4 8S | 1 pack | Penyimpan energi (200Ah, 25.6V nominal) |
| 74HC595 Shift Register | 4 buah | Ekspansi GPIO untuk 32 output relay |
| Relay Module (Active-Low) | 13 unit | Saklar elektronik perangkat rumah tangga |
| Solid State Relay / MOSFET | 1 unit | PV Disconnect (putus panel surya) |
| INA219 | 1 | Sensor tegangan & arus DC output MPPT |
| ADS1115 (16-bit ADC) | 2 | Monitoring tegangan 8 sel baterai individual |
| ACS712-30A | 1 | Sensor arus AC beban rumah (RMS) |
| SHT31 | 1 | Sensor suhu & kelembaban ruangan |
| PIR HC-SR501 | 4 | Deteksi gerakan untuk otomasi pencahayaan |
| LED (dengan driver PWM) | 1 | Lampu dimmable (Lampu Kamar Fatimah) |
| MicroSD Card | 1 | Logging data sensor secara lokal |
| Resistor Voltage Divider | 1 set | Pembagi tegangan untuk monitoring sel (360kΩ + 10kΩ) |
| Pull-up Resistor 4.7kΩ | 4 | Pull-up I2C (SDA & SCL) |

### Wiring Diagram I2C

```
ESP32 GPIO21 (SDA) ──────┬──── INA219 (0x40)
                         ├──── ADS1115 #1 (0x48)
ESP32 GPIO22 (SCL) ──────┤──── ADS1115 #2 (0x49)
                         └──── SHT31 (0x44)

4.7kΩ ke VCC pada masing-masing SDA & SCL
```

---

## 4. Pemetaan GPIO ESP32

### Tabel Pin GPIO Lengkap

| GPIO | Mode | Fungsi | Keterangan |
|:----:|:----:|--------|------------|
| **2** | OUTPUT | Status LED | Built-in LED, indikator status sistem |
| **4** | OUTPUT | PWM Channel 2 | LEDC PWM cadangan |
| **5** | OUTPUT | SD Card CS | Chip Select SPI |
| **12** | OUTPUT | PWM Channel 1 | LEDC PWM cadangan |
| **13** | OUTPUT | PWM Channel 0 | Dimmer Lampu Kamar Fatimah |
| **14** | OUTPUT | Shift Register DS | Serial Data Input 74HC595 |
| **18** | OUTPUT | SD Card SCK | SPI Clock |
| **19** | INPUT | SD Card MISO | Master In Slave Out |
| **21** | I/O | I2C SDA | Data bus I2C (pull-up 4.7kΩ) |
| **22** | I/O | I2C SCL | Clock bus I2C (pull-up 4.7kΩ) |
| **23** | OUTPUT | SD Card MOSI | Master Out Slave In |
| **25** | OUTPUT | Shift Register OE | Output Enable (ACTIVE LOW) |
| **26** | OUTPUT | Shift Register SH_CP | Shift Register Clock |
| **27** | OUTPUT | Shift Register ST_CP | Storage Register Clock (Latch) |
| **33** | INPUT | ACS712 Output | Analog output sensor arus AC |
| **34** | INPUT | PIR Sensor 1 | Hanya input (no pull-up) |
| **35** | INPUT | PIR Sensor 2 | Hanya input (no pull-up) |
| **36** (VP) | INPUT | PIR Sensor 3 | Hanya input (no pull-up) |
| **39** (VN) | INPUT | PIR Sensor 4 | Hanya input (no pull-up) |

### Perhatian Penting

> ⚠️ **GPIO 34, 35, 36, 39** hanya dapat digunakan sebagai **input** dan tidak memiliki pull-up/pull-down internal. Pin PIR harus menggunakan resistor pull-up eksternal atau mengandalkan pull-up modul PIR.

> ⚠️ **GPIO 12** memiliki perilaku boot-strapping — pastikan tidak dalam keadaan LOW saat boot agar ESP32 masuk mode flash normal.

> ⚠️ **Shift Register OE (GPIO 25)** dibiarkan HIGH saat boot (semua relay OFF) untuk keselamatan. OE baru diaktifkan setelah inisialisasi selesai (safety delay 2 detik).

---

## 5. Struktur File Proyek

```
PLTS-SmartHome/
│
├── README.md                              ← Dokumentasi ini
├── Spesifikasi_Teknis_PLTS_SmartHome.pdf  ← Dokumen spesifikasi teknis
│
├── google-apps-script/                    ← Backend (10 file .gs)
│   ├── Code.gs                            ← Router utama, doGet/doPost
│   ├── Config_.gs                         ← Konfigurasi (Sheet ID, JWT, relay names)
│   ├── Auth.gs                            ← Login, JWT, session management
│   ├── Database.gs                        ← CRUD helper Google Sheets
│   ├── SensorData.gs                      ← Upload & query data sensor
│   ├── RelayCommands.gs                   ← Kontrol relay, PWM, PV disconnect
│   ├── RulesEngine.gs                     ← Manajemen automation rules
│   ├── PIRConfig.gs                       ← Konfigurasi mapping PIR-to-relay
│   ├── UserManager.gs                     ← CRUD manajemen user
│   └── EventLog.gs                        ← Logging event sistem
│
├── web-dashboard/                         ← Frontend PWA (15 file)
│   ├── index.html                         ← Halaman login
│   ├── dashboard.html                     ← Halaman dashboard utama
│   ├── manifest.json                      ← PWA manifest
│   ├── sw.js                              ← Service Worker (offline cache)
│   ├── css/
│   │   └── style.css                      ← Stylesheet utama
│   ├── js/
│   │   ├── utils.js                       ← Helper functions
│   │   ├── auth.js                        ← Login/logout, session management
│   │   ├── api.js                         ← HTTP client ke GAS backend
│   │   ├── app.js                         ← Core app initialization & routing
│   │   ├── dashboard.js                   ← Chart rendering, data display
│   │   ├── controls.js                    ← Relay & PWM control interface
│   │   ├── rules-editor.js                ← Visual rule builder
│   │   ├── admin.js                       ← User management interface
│   │   └── pwa.js                         ← PWA install & update
│   └── assets/                            ← Icons & images
│       ├── icon-192.png
│       └── icon-512.png
│
├── esp32-firmware-arduino/                ← Firmware ESP32 Arduino IDE (31 file)
│   └── PLTS_SmartHome/
│       ├── PLTS_SmartHome.ino             ← Entry point & main loop
│       ├── config.h                       ← Konfigurasi master
│       ├── sensors.h                      ← Umbrella header sensor
│       ├── sensor_manager.h/.cpp          ← Aggregator semua sensor
│       ├── sensor_ina219.h/.cpp           ← Driver INA219 (MPPT)
│       ├── sensor_ads1115.h/.cpp          ← Driver ADS1115 (8 sel baterai)
│       ├── sensor_acs712.h/.cpp           ← Driver ACS712 (arus AC)
│       ├── sensor_sht31.h/.cpp            ← Driver SHT31 (suhu/kelembaban)
│       ├── sensor_pir.h/.cpp              ← Driver PIR (deteksi gerakan)
│       ├── wifi_manager.h/.cpp            ← WiFi connect & reconnect
│       ├── api_client.h/.cpp              ← HTTPS client ke GAS backend
│       ├── shift_register.h/.cpp          ← Driver 74HC595 (4x daisy-chain)
│       ├── relay_manager.h/.cpp           ← Kontrol 13 relay + PV disconnect
│       ├── pwm_ctrl.h/.cpp                ← LEDC PWM 3 channel
│       ├── rules_engine.h/.cpp            ← Evaluasi automation rules
│       ├── command_handler.h/.cpp         ← Proses perintah dari server
│       └── sd_logger.h/.cpp               ← Logging ke SD card
│
└── esp32-firmware/                        ← Versi PlatformIO (legacy, tidak digunakan)
```

---

## 6. Instalasi & Setup

### 6.1 Google Apps Script Backend

#### Prasyarat

- Akun Google (Gmail)
- Google Sheets (Spreadsheet baru)
- Google Apps Script ([script.google.com](https://script.google.com))

#### Langkah Setup

**Langkah 1 — Buat Google Spreadsheet baru** di Google Sheets. Buat sheet-sheet (tab) berikut dengan header kolom persis seperti di bawah:

| Nama Sheet | Header Kolom |
|------------|-------------|
| `sensor_data` | `timestamp`, `v_mppt`, `i_mppt`, `p_mppt`, `v_pack`, `soc_pct`, `temp`, `humi`, `v_cell1`-`v_cell8`, `i_ac`, `p_ac`, `pir1`-`pir4`, `relay_states`, `pwm_values`, `pv_connected` |
| `relay_status` | `timestamp`, `relay_id`, `state`, `commanded_by`, `commanded_at` |
| `config` | `key`, `value`, `updated_by`, `updated_at` |
| `automation_rules` | `id`, `name`, `trigger_type`, `trigger_params`, `conditions_logic`, `conditions`, `actions`, `timeout_sec`, `enabled`, `priority`, `created_at`, `updated_at` |
| `event_log` | `timestamp`, `event_type`, `severity`, `message`, `source`, `details` |
| `user_db` | `username`, `password_hash`, `role`, `active`, `created_at`, `last_login`, `created_by` |
| `session_db` | `token`, `username`, `role`, `created_at`, `expires_at`, `ip_address`, `user_agent` |

**Langkah 2 — Buka Google Apps Script** → Extensions → Apps Script (dari Spreadsheet). Atau buka [script.google.com](https://script.google.com) → New Project.

**Langkah 3 — Copy semua file `.gs`** dari folder `google-apps-script/` ke project GAS. Buat file baru untuk masing-masing:

- `Code.gs` — paste isi file
- `Config_.gs` — paste isi file
- `Auth.gs` — paste isi file
- `Database.gs` — paste isi file
- `SensorData.gs` — paste isi file
- `RelayCommands.gs` — paste isi file
- `RulesEngine.gs` — paste isi file
- `PIRConfig.gs` — paste isi file
- `UserManager.gs` — paste isi file
- `EventLog.gs` — paste isi file

**Langkah 4 — Konfigurasi `Config_.gs`:**

```javascript
var SPREADSHEET_ID = 'PASTE_SPREADSHEET_ID_ANDA_DISINI';
var JWT_SECRET = 'BUAT_STRING_RANDOM_MINIMAL_32_KARAKTER';
var DEVICE_API_KEY = 'BUAT_API_KEY_RANDOM_UNTUK_ESP32';
```

**Langkah 5 — Deploy sebagai Web App:**

1. Klik **Deploy → New deployment**
2. Type: **Web app**
3. Execute as: **Me**
4. Who has access: **Anyone**
5. Salin URL Web App yang dihasilkan (format: `https://script.google.com/macros/s/XXXXX/exec`)

**Langkah 6 — Buat user admin pertama:**

Buka sheet `user_db` di Google Sheets, tambahkan baris pertama:

| Field | Value |
|-------|-------|
| `username` | `admin` |
| `password_hash` | hash SHA-256 dari password yang diinginkan (gunakan [SHA-256 generator](https://emn178.github.io/online-tools/sha256.html)) |
| `role` | `admin` |
| `active` | `true` |
| `created_at` | tanggal saat ini (ISO 8601) |
| `last_login` | *(kosongkan)* |
| `created_by` | `system` |

**Langkah 7 — Setup trigger otomatis** (pembersihan session expired):

1. Buka Script Editor GAS
2. Dari dropdown function, pilih `setupTrigger`
3. Klik **Run**
4. Berikan izin yang diminta
5. Ini akan membuat trigger yang berjalan setiap **6 jam** untuk membersihkan session expired

#### ✅ Verifikasi Backend

Buka URL Web App di browser (tanpa parameter). Respons yang benar:

```json
{
  "success": true,
  "service": "PLTS SmartHome API",
  "version": "1.0.0",
  "timestamp": "2025-04-03T..."
}
```

---

### 6.2 Web Dashboard (PWA)

#### Prasyarat

- Web server (hosting statis) — dapat menggunakan:
  - [GitHub Pages](https://pages.github.com)
  - [Netlify](https://www.netlify.com)
  - [Vercel](https://vercel.com)
  - Firebase Hosting
  - Apache/Nginx di Raspberry Pi atau VPS
  - Atau langsung buka `index.html` di browser untuk development

#### Langkah Setup

**Langkah 1 — Upload** folder `web-dashboard/` ke web hosting Anda.

**Langkah 2 — Buat file icon:**

- `assets/icon-192.png` — Icon 192×192px
- `assets/icon-512.png` — Icon 512×512px
- Gunakan icon bertema surya/rumah

**Langkah 3 — Konfigurasi API URL:**

Buka file `js/api.js`, cari dan ganti placeholder URL:

```javascript
const API_BASE_URL = 'https://script.google.com/macros/s/XXXXX/exec';
```

**Langkah 4 — Test login:**

Buka `index.html` di browser, login dengan username `admin` dan password yang sudah di-hash.

**Langkah 5 — Install sebagai PWA** (opsional):

1. Buka dashboard di Chrome (Android) atau Safari (iOS)
2. **Android:** Klik ikon "Add to Home Screen" di menu browser
3. **iOS:** Klik Share → "Add to Home Screen"
4. Dashboard akan berjalan sebagai aplikasi native dengan offline support

> 💡 **Catatan CORS:** Google Apps Script secara otomatis menangani CORS. Tidak perlu konfigurasi tambahan. Namun, jika menggunakan HTTPS redirect, pastikan ESP32 firmware mengikuti redirect (sudah diimplementasikan di `api_client.cpp`).

---

### 6.3 ESP32 Firmware (Arduino IDE)

#### Prasyarat

- Arduino IDE v2.3.8 (atau versi terbaru)
- Board package ESP32 terinstall
- Library Arduino yang dibutuhkan

#### Install Board ESP32

1. Buka Arduino IDE → **File → Preferences**
2. Di "Additional Boards Manager URLs", tambahkan:

```
https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json
```

3. Buka **Tools → Board → Boards Manager**
4. Cari `"esp32"` dan install **esp32 by Espressif Systems**

#### Install Library

Buka **Tools → Manage Libraries**, install library berikut:

| Library | Versi | Keterangan |
|---------|-------|------------|
| Adafruit INA219 | terbaru | Sensor tegangan & arus DC |
| Adafruit ADS1X15 | terbaru | ADC 16-bit (ADS1115) |
| Adafruit SHT31 | terbaru | Sensor suhu & kelembaban |
| Adafruit BusIO | terbaru | Dependency I2C |
| ArduinoJson | 7.x | Parsing JSON response |
| WiFi (built-in) | — | Sudah termasuk di ESP32 core |
| WebServer (built-in) | — | Untuk captive portal |
| SPI (built-in) | — | Untuk SD card |
| SD (built-in) | — | Untuk SD card |
| FS (built-in) | — | Filesystem |
| LittleFS (built-in) | — | Filesystem internal ESP32 |

#### Upload Firmware

**Langkah 1** — Buka sketch Arduino IDE → **File → Open** → pilih `PLTS_SmartHome.ino` dari folder `esp32-firmware-arduino/PLTS_SmartHome/`. Arduino IDE akan otomatis mendeteksi semua file `.h` dan `.cpp` yang berada dalam folder yang sama sebagai tab.

**Langkah 2** — Konfigurasi WiFi — buka `wifi_manager.h` dan isi:

```cpp
#define WIFI_SSID     "NAMA_WIFI_ANDA"
#define WIFI_PASSWORD "PASSWORD_WIFI_ANDA"
```

**Langkah 3** — Konfigurasi Backend — buka `config.h` dan isi:

```cpp
#define GAS_SCRIPT_URL   "https://script.google.com/macros/s/XXXXX/exec"
#define DEVICE_API_KEY   "API_KEY_YANG_SAMA_DENGAN_CONFIG_.gs"
```

**Langkah 4** — Pilih Board & Port:

| Setting | Value |
|---------|-------|
| Board | ESP32 Dev Module |
| Upload Speed | 921600 |
| CPU Frequency | 240MHz |
| Flash Frequency | 80MHz |
| Flash Mode | QIO |
| Flash Size | 4MB |
| Partition Scheme | Default 4MB with spiffs |
| Port | *(pilih COM port ESP32)* |

**Langkah 5** — Klik tombol **Upload** atau `Ctrl+U`.

**Langkah 6** — Buka **Serial Monitor** (115200 baud) untuk melihat output:

```
PLTS SmartHome ESP32 Firmware v1.0.0
Device: PLTS-SmartHome-ESP32
Compiled: Apr 3 2025 12:00:00
[BOOT] Mounting LittleFS... OK
[BOOT] Initializing SD card... OK
[BOOT] Sensors initialized successfully
...

SYSTEM SUMMARY
WiFi Status : Connected
IP Address  : 192.168.1.xxx
RSSI        : -45 dBm
Sensors     : All OK
Rules Loaded: 0
SD Card     : Available
Free Heap   : 234567 bytes
Boot Time   : 3210 ms
Type 'help' for serial commands
```

---

## 7. Konfigurasi

### 7.1 Config_.gs — Backend

| Parameter | Deskripsi | Contoh |
|-----------|-----------|--------|
| `SPREADSHEET_ID` | ID Google Spreadsheet (dari URL) | `"1aBcDeFgHiJkLmNoPqRsTuVwXyZ"` |
| `JWT_SECRET` | Secret key untuk JWT (min. 32 karakter) | `"my-super-secret-jwt-key-2025-plts"` |
| `JWT_EXPIRY_HOURS` | Masa berlaku token (jam) | `24` |
| `DEVICE_API_KEY` | API key untuk autentikasi ESP32 | `"esp32-device-key-2025-secret"` |
| `LONG_POLL_TIMEOUT_MS` | Timeout long-poll (ms) | `10000` |
| `SENSOR_DATA_MAX_ROWS` | Maksimal baris data sensor | `10080` (7 hari) |
| `EVENT_LOG_MAX_ROWS` | Maksimal baris event log | `5000` |

### 7.2 config.h — ESP32 Firmware

| Parameter | Default | Deskripsi |
|-----------|---------|-----------|
| `GAS_SCRIPT_URL` | `""` | URL Web App GAS backend (**WAJIB** diisi) |
| `DEVICE_API_KEY` | `""` | API key yang sama dengan Config_.gs (**WAJIB** diisi) |
| `SENSOR_READ_INTERVAL_MS` | `5000` | Interval baca sensor (ms) |
| `DATA_UPLOAD_INTERVAL_MS` | `60000` | Interval upload data ke server (ms) |
| `LONG_POLL_INTERVAL_MS` | `12000` | Interval long-poll perintah (ms) |
| `RULE_CHECK_INTERVAL_MS` | `5000` | Interval evaluasi rules (ms) |
| `WATCHDOG_TIMEOUT_SEC` | `60` | Hardware watchdog timeout (detik) |
| `PWM_FREQ_HZ` | `5000` | Frekuensi PWM (Hz) |
| `PWM_RESOLUTION_BITS` | `8` | Resolusi PWM (bit) |

### 7.3 WiFi Credentials

WiFi dikonfigurasi di file `wifi_manager.h`:

```cpp
#define WIFI_SSID     "NAMA_WIFI"
#define WIFI_PASSWORD "PASSWORD_WIFI"
```

**Fitur WiFi Manager:**

- ✅ Auto-reconnect dengan exponential backoff
- ✅ Monitoring RSSI (kekuatan sinyal)
- ✅ Timeout koneksi 15 detik
- ✅ Retry maksimal 3 kali per siklus reconnect
- ✅ Jika gagal terhubung, sistem berjalan dalam **LOCAL MODE** (sensor tetap terbaca, rules tetap dievaluasi, namun tidak ada sinkronisasi data ke server)

---

## 8. Referensi API

> **Base URL:** Semua request menggunakan method `POST` dengan content type `URL-encoded` (`application/x-www-form-urlencoded`). Semua response dalam format JSON.

### Struktur Response

```json
{
  "success": true,
  "data": { ... },
  "error": "...",
  "_status": 200
}
```

---

### 8.1 Endpoint Publik

#### `doGet` — Health Check

```
GET {WEB_APP_URL}
```

Tidak memerlukan autentikasi.

#### `login` — Login User

```
POST {WEB_APP_URL}
Body: action=login&username=xxx&password_hash=SHA256(password)
```

| Field | Tipe | Wajib | Deskripsi |
|-------|------|:-----:|-----------|
| `action` | string | ✅ | `"login"` |
| `username` | string | ✅ | Username (case-insensitive) |
| `password_hash` | string | ✅ | SHA-256 hash dari password |

**Response:**

```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "role": "admin",
  "username": "admin"
}
```

---

### 8.2 Endpoint Autentikasi

> 🔒 Semua endpoint di bawah memerlukan header/token `token` yang valid.

#### `logout` — Logout

```
action=logout&token=JWT_TOKEN
```

#### `changePassword` — Ganti Password

```
action=changePassword&token=JWT_TOKEN&old_password_hash=SHA256(lama)&new_password_hash=SHA256(baru)
```

---

### 8.3 Endpoint Sensor Data

#### `getSensorData` — Data Sensor Terbaru

```
action=getSensorData&token=JWT_TOKEN
```

Response berisi data pembacaan sensor terakhir dari sheet `sensor_data`.

#### `getSensorHistory` — Riwayat Data Sensor

```
action=getSensorHistory&token=JWT_TOKEN&minutes=60
```

| Parameter | Tipe | Deskripsi |
|-----------|------|-----------|
| `minutes` | int | Jumlah menit terakhir yang diminta |

---

### 8.4 Endpoint Kontrol Perangkat

> 🔒 Memerlukan role: **admin** atau **technician**

#### `setRelay` — Kontrol Relay

```
action=setRelay&token=JWT_TOKEN&relay_id=1&state=true&commanded_by=user
```

| Parameter | Tipe | Deskripsi |
|-----------|------|-----------|
| `relay_id` | int | ID relay (1-13) atau 14 (PV disconnect) |
| `state` | bool | `true` = ON, `false` = OFF |
| `commanded_by` | string | Sumber: `"user"`, `"rule"`, `"schedule"` |

#### `setPWM` — Kontrol PWM

```
action=setPWM&token=JWT_TOKEN&channel=0&value=75
```

| Parameter | Tipe | Deskripsi |
|-----------|------|-----------|
| `channel` | int | Channel PWM (0-2) |
| `value` | int | Duty cycle (0-100%) |

#### `setPVDisconnect` — PV Disconnect

```
action=setPVDisconnect&token=JWT_TOKEN&state=true
```

| Parameter | Tipe | Deskripsi |
|-----------|------|-----------|
| `state` | bool | `true` = connect, `false` = disconnect |

---

### 8.5 Endpoint Rules Engine

> 🔒 Memerlukan role: **admin** atau **technician**

#### `getRules` — Ambil Semua Rules

```
action=getRules&token=JWT_TOKEN
```

#### `saveRule` — Simpan Rule Baru/Edit

```
action=saveRule&token=JWT_TOKEN&id=xxx&name=xxx&trigger_type=batt&...
```

#### `deleteRule` — Hapus Rule

```
action=deleteRule&token=JWT_TOKEN&id=xxx
```

---

### 8.6 Endpoint Manajemen User

> 🔒 Memerlukan role: **admin**

#### `getUsers` — Daftar Semua User

```
action=getUsers&token=JWT_TOKEN
```

#### `createUser` — Buat User Baru

```
action=createUser&token=JWT_TOKEN&username=xxx&password_hash=SHA256(xxx)&role=technician
```

#### `deleteUser` — Hapus User

```
action=deleteUser&token=JWT_TOKEN&username=xxx
```

#### `resetPassword` — Reset Password

```
action=resetPassword&token=JWT_TOKEN&username=xxx&new_password_hash=SHA256(xxx)
```

---

### 8.7 Endpoint Device (ESP32)

> 🔑 Autentikasi menggunakan `api_key` (bukan JWT token).

#### `deviceAuth` — Autentikasi Device

```
action=deviceAuth&api_key=DEVICE_API_KEY
```

#### `uploadSensorData` — Upload Data Sensor

```
action=uploadSensorData&api_key=DEVICE_API_KEY&v_mppt=24.5&i_mppt=2.1&...
```

Field yang dikirim ESP32: `v_mppt`, `i_mppt`, `p_mppt`, `v_pack`, `soc_pct`, `temp`, `humi`, `v_cell1`-`v_cell8`, `i_ac`, `p_ac`, `pir1`-`pir4`, `relay_states`, `pwm_values`, `pv_connected`, `timestamp`.

#### `pollCommands` — Long Poll Perintah

```
action=pollCommands&api_key=DEVICE_API_KEY
```

ESP32 akan menunggu hingga **10 detik**. Jika ada perintah baru dari dashboard, response akan berisi perintah relay/PWM/PV disconnect. Jika tidak ada perintah, response berisi `has_commands: false`.

#### `downloadRules` — Download Automation Rules

```
action=downloadRules&api_key=DEVICE_API_KEY
```

#### `reportRelayState` — Laporan Status Relay

```
action=reportRelayState&api_key=DEVICE_API_KEY&relay_states=...
```

#### `reportEvent` — Laporan Event

```
action=reportEvent&api_key=DEVICE_API_KEY&event_type=alarm&message=Low battery
```

---

### 8.8 Endpoint Logging & Config

#### `getEventLog` — Ambil Event Log

```
action=getEventLog&token=JWT_TOKEN&limit=100&severity=error
```

#### `getSystemConfig` — Ambil Konfigurasi Sistem

```
action=getSystemConfig&token=JWT_TOKEN
```

---

## 9. Spesifikasi Sensor

### 9.1 INA219 — Output MPPT

| Parameter | Nilai |
|-----------|-------|
| I2C Address | `0x40` |
| Shunt Resistor | 0.1 Ω |
| Max Current | 3.2 A |
| Max Voltage | 32 V |
| Resolusi Current | 0.1 mA |
| Resolusi Voltage | 4 mV |

**Data yang dibaca:**

- `v_mppt` — Tegangan output MPPT (V)
- `i_mppt` — Arus output MPPT (A)
- `p_mppt` — Daya output MPPT (W) = `v_mppt × i_mppt`

---

### 9.2 ADS1115 — Monitoring Sel Baterai

| Parameter | Nilai |
|-----------|-------|
| Jumlah ADC | 2 buah |
| I2C Address #1 | `0x48` (Sel 1-4) |
| I2C Address #2 | `0x49` (Sel 5-8) |
| Resolusi | 16-bit |
| Gain | GAIN_ONE (±4.096V) |
| Samples per read | 16 (averaging) |

**Voltage Divider untuk monitoring sel:**

```
         R_top = 10kΩ
  Sel ────/\/\/\/────┬──── ADS1115 Input
                     │
         R_bottom = 360kΩ
                     │
                    GND
```

- Rasio pembagi: `V_adc = V_cell × (360/370) = V_cell × 0.97297`
- Faktor kalibrasi: `V_cell = V_adc × 1.02778`
- Range per sel: 2.5V – 3.65V (LiFePO4)
- Setiap ADC membaca 2 sel (differential mode)

**Data yang dibaca:**

- `v_cell[0]` – `v_cell[7]` — Tegangan sel 1-8 (V)
- `v_pack` — Total tegangan pack (V) = `sum(v_cell[0..7])`
- `soc_pct` — State of Charge (%) = linear approximation

---

### 9.3 ACS712-30A — Arus AC Beban

| Parameter | Nilai |
|-----------|-------|
| Model | ACS712-30A |
| Range | ±30A |
| Sensitivitas | 66 mV/A |
| Vref | 3.3V (ADC ESP32) |
| ADC Resolution | 12-bit |
| Zero Offset | ~1650 (kalibrasi) |
| Samples RMS | 50 |

**Data yang dibaca:**

- `i_ac` — Arus AC beban (A, RMS)
- `p_ac` — Perkiraan daya AC (W) = `i_ac × 220V`

---

### 9.4 SHT31 — Suhu & Kelembaban

| Parameter | Nilai |
|-----------|-------|
| I2C Address | `0x44` (default) |
| Range Suhu | -40°C to +80°C |
| Akurasi Suhu | ±0.3°C |
| Range Kelembaban | 0-100% RH |
| Akurasi Kelembaban | ±2% RH |

**Data yang dibaca:**

- `temp` — Suhu lingkungan (°C)
- `humi` — Kelembaban relatif (%)

---

### 9.5 PIR — Deteksi Gerakan

| Parameter | Nilai |
|-----------|-------|
| Jumlah Sensor | 4 buah |
| GPIO | 34, 35, 36, 39 |
| Debounce | 3000 ms |
| Timeout | 300 detik (5 menit) |

**Data yang dibaca:**

- `pir[0]` – `pir[3]` — Status PIR 1-4 (boolean)

---

## 10. Sistem Baterai 8S LiFePO4

### Spesifikasi Pack

| Parameter | Nilai |
|-----------|-------|
| Konfigurasi | 8 Series (8S) |
| Kimia | LiFePO4 (Lithium Iron Phosphate) |
| Kapasitas | 200 Ah |
| Tegangan Nominal | 25.6V (8 × 3.2V) |
| Tegangan Full Charge | 29.2V (8 × 3.65V) |
| Tegangan Critical Low | 20.0V (8 × 2.5V) |
| Energi Total | ~5.12 kWh (200Ah × 25.6V) |

### Threshold SOC (State of Charge)

| Level | SOC (%) | Tegangan Pack | Aksi Sistem |
|-------|:-------:|:-------------:|-------------|
| 🟢 **Penuh** | 100% | ≥29.2V | Normal operation |
| 🔵 **Normal** | 20-100% | 24.64V – 29.2V | Normal operation |
| 🟡 **Low** | 10-20% | 22.32V – 24.64V | Kurangi beban (rules engine) |
| 🔴 **Critical** | 0-10% | <22.32V | Disconnect beban berat |

### Perhitungan SOC

SOC dihitung menggunakan aproksimasi linear berdasarkan tegangan pack:

```
SOC (%) = ((V_pack - V_min) / (V_max - V_min)) × 100
```

**Contoh:**

```
V_pack = 26.4V
SOC = ((26.4 - 20.0) / (29.2 - 20.0)) × 100
SOC = (6.4 / 9.2) × 100 = 69.6%
```

> 💡 **Catatan:** Metode ini bersifat estimasi. Untuk akurasi yang lebih tinggi, dapat ditambahkan Coulomb Counting di firmware versi mendatang.

---

## 11. Sistem Kontrol Relay

### Konfigurasi 74HC595 Shift Register

4 buah IC 74HC595 daisy-chained menyediakan 32-bit output digital:

```
            Register 1 (bit 0-7)
            ┌─────────────────────┐
  Data ──► │ Q0 Q1 Q2 Q3 Q4 Q5 Q6 Q7 │── Relay 1-8
            └─────────────────────┘
                         │ Serial Out
            Register 2 (bit 8-15)
            ┌─────────────────────┐
            │ Q0 Q1 Q2 Q3 Q4 Q5 Q6 Q7 │── Relay 9-13, PV Disconnect
            └─────────────────────┘      (bit 13 = PV)
                         │
            Register 3 (bit 16-23)  ← Cadangan ekspansi
            Register 4 (bit 24-31)  ← Cadangan ekspansi
```

### Mapping Relay

| Bit | Relay ID | Nama | Keterangan |
|:---:|:--------:|------|------------|
| 0 | 1 | Lampu Teras | Lampu teras depan |
| 1 | 2 | Lampu Tengah | Lampu ruang tengah |
| 2 | 3 | Lampu Tengah Aux | Lampu tambahan ruang tengah |
| 3 | 4 | Lampu Kamar Ayah | Lampu kamar ayah |
| 4 | 5 | Lampu Kamar Fatimah | Dimmable via PWM Channel 0 |
| 5 | 6 | Lampu Kamar Mandi | Lampu kamar mandi |
| 6 | 7 | Lampu Gudang | Lampu gudang |
| 7 | 8 | Lampu Belakang | Lampu belakang rumah |
| 8 | 9 | Lampu Kamar | Lampu kamar tambahan |
| 9 | 10 | Kipas Utama | Kipas angin utama |
| 10 | 11 | Kipas Panel | Kipas panel surya |
| 11 | 12 | Inverter | Inverter DC-AC |
| 12 | 13 | Air Conditioner | AC pendingin ruangan |
| 13 | 14 | PV Disconnect | Putus hubungan panel surya |

### Sifat Relay Active-LOW

Semua relay menggunakan konfigurasi **active-LOW**, artinya:

- **Bit 1** di shift register → relay **ON** (energi mengalir)
- **Bit 0** di shift register → relay **OFF** (aman)

Firmware secara otomatis melakukan bit inversion sebelum mengirim ke shift register.

### Safety Mechanism

1. **Boot Safety:** GPIO OE (Output Enable) dibiarkan HIGH saat boot → semua relay OFF
2. **Safety Delay:** Minimal 2 detik setelah boot sebelum relay diaktifkan
3. **PV Disconnect:** Relay #14 secara independen memutus panel surya dari sistem

---

## 12. Sistem Otomasi (Rules Engine)

### Konsep

Rules engine memungkinkan pembuatan aturan otomasi berdasarkan kondisi sensor. Rules dapat dibuat dari dashboard web dan dievaluasi secara lokal di ESP32 serta di server GAS.

### Struktur Rule

```json
{
  "id": "string",
  "name": "string",
  "trigger_type": "string",
  "conditions_logic": "AND | OR",
  "conditions": [
    { "sensor_id": "soc_pct", "op": "<", "value": 20 },
    { "sensor_id": "temp", "op": ">", "value": 35 }
  ],
  "actions": [
    { "type": "relay_off", "target": 13, "value": 0 },
    { "type": "pwm_set", "target": 0, "value": 50 },
    { "type": "notification", "message": "Baterai rendah!" }
  ],
  "timeout_sec": 0,
  "enabled": true,
  "priority": 10
}
```

| Field | Tipe | Deskripsi |
|-------|------|-----------|
| `id` | string | ID unik (UUID) |
| `name` | string | Nama deskriptif |
| `trigger_type` | string | `"time"`, `"batt"`, `"temp"`, `"humi"`, `"pir"`, `"pv_i"`, `"ac_i"`, `"manual"` |
| `conditions_logic` | string | `"AND"` atau `"OR"` |
| `conditions[]` | array | Kondisi yang harus terpenuhi |
| `actions[]` | array | Aksi yang dilakukan saat rule terpicu |
| `timeout_sec` | int | Timeout aksi (0 = permanen) |
| `enabled` | boolean | Aktif/nonaktif |
| `priority` | int | Prioritas (lebih tinggi = diproses dulu) |

### Contoh Rule

#### Rule 1: Matikan AC saat baterai rendah

```
IF soc_pct < 20% AND pir1 == false
THEN relay_off(13), relay_off(10), notification("Baterai rendah! Beban berat dimatikan.")
PRIORITY: 10
TIMEOUT: 0 (permanen sampai SOC kembali normal)
```

#### Rule 2: Nyalakan lampu saat deteksi gerakan

```
IF pir1 == true
THEN relay_on(1)
PRIORITY: 5
TIMEOUT: 300 (matikan otomatis setelah 5 menit)
```

#### Rule 3: Nyalakan kipas saat suhu tinggi

```
IF temp > 32°C
THEN relay_on(10)
PRIORITY: 8
TIMEOUT: 0
```

### Trigger Types

| Trigger Type | Sensor yang Dimonitor | Contoh |
|-------------|----------------------|--------|
| `batt` | SOC, v_pack, v_cell | `soc_pct < 20` |
| `temp` | Suhu (SHT31) | `temp > 35` |
| `humi` | Kelembaban (SHT31) | `humi > 80` |
| `pir` | Sensor gerakan | `pir1 == true` |
| `pv_i` | Arus MPPT | `i_mppt > 1.0` |
| `ac_i` | Arus AC beban | `i_ac > 5.0` |
| `time` | Waktu (jam, menit) | `hour >= 18` |
| `manual` | Trigger manual dari dashboard | — |

### Evaluasi Rules

- Rules dievaluasi setiap **5 detik** di ESP32 (`rules_engine.cpp`)
- Evaluasi bersifat **edge detection** — rule hanya trigger sekali saat kondisi berubah dari `false → true`
- **Prioritas** menentukan urutan evaluasi
- Multiple rules dapat trigger secara bersamaan
- Konflik antar rules (misalnya rule A ON relay 1, rule B OFF relay 1) diselesaikan berdasarkan prioritas

---

## 13. Web Dashboard (PWA)

### Fitur Dashboard

| Fitur | Deskripsi |
|-------|-----------|
| 🌙 **Dark/Light Theme** | Toggle tema gelap/terang |
| 📱 **Responsive Design** | Tampil optimal di desktop, tablet, dan mobile |
| 📲 **PWA Install** | Install sebagai aplikasi di home screen |
| 💾 **Offline Cache** | Data terakhir tersimpan di cache (via Service Worker) |

### Halaman

#### 1. Login Page (`index.html`)

- Form login dengan username & password (SHA-256 hash)
- Toggle tampil/sembunyikan password
- Error message animasi
- Latar belakang gradient animasi

#### 2. Dashboard (`dashboard.html`)

- **Header:** Logo, judul, user info, tombol logout
- **Sidebar:** Navigasi menu (Dashboard, Kontrol, Rules, Admin)

**Halaman Dashboard:**

- Kartu ringkasan: V_MPPT, V_Pack, SOC, Suhu, Kelembaban
- Grafik: V_Pack dan SOC vs waktu (Chart.js)
- Grafik: Tegangan sel individual (bar chart)
- Status relay (toggle ON/OFF)
- Status PWM (slider)
- Event log terbaru

**Halaman Kontrol:**

- Grid relay dengan toggle switch
- Kontrol PWM dengan slider
- Tombol PV Disconnect dengan konfirmasi

**Halaman Rules:**

- Daftar rules aktif/nonaktif
- Editor rule visual (builder)
- Toggle enable/disable per rule
- Delete rule

**Halaman Admin** *(hanya role admin):*

- Daftar user
- Buat user baru
- Reset password
- Hapus user

### Teknologi Frontend

| Teknologi | Fungsi |
|-----------|--------|
| HTML5/CSS3/JavaScript | Bahasa utama |
| Chart.js 4.x | Grafik data sensor |
| CSS Custom Properties | Sistem tema (dark/light) |
| CSS Grid & Flexbox | Layout responsif |
| Service Worker | Offline caching |
| Web App Manifest | PWA metadata |

---

## 14. Perintah Serial ESP32

> Buka Serial Monitor di Arduino IDE (**115200 baud**) untuk mengakses perintah debug.

| Perintah | Argumen | Deskripsi |
|----------|---------|-----------|
| `help` | — | Tampilkan daftar perintah |
| `status` | — | Tampilkan semua pembacaan sensor terakhir |
| `relay` | `<id> <on\|off>` | Kontrol relay manual (id: 1-14) |
| `pwm` | `<ch> <val>` | Set PWM duty cycle (ch: 0-2, val: 0-100) |
| `rules` | — | Tampilkan rules yang dimuat |
| `wifi` | — | Tampilkan status WiFi |
| `heap` | — | Tampilkan informasi memori heap |
| `sd` | — | Tampilkan status SD card |
| `restart` | — | Restart ESP32 |
| `factory` | — | Format LittleFS & SD card, lalu restart |

**Contoh:**

```
> relay 5 on        ← Nyalakan Lampu Kamar Fatimah
> relay 14 off      ← Putuskan hubungan panel surya
> pwm 0 75          ← Set PWM channel 0 ke 75%
> status            ← Tampilkan data sensor lengkap
> heap              ← Cek memori tersisa
```

---

## 15. Status LED Pattern

LED built-in (GPIO 2) menunjukkan status sistem melalui pola kedip:

| Status Sistem | Pola LED | Deskripsi |
|--------------|----------|-----------|
| 🟡 **Booting** | Solid ON | Sistem sedang inisialisasi |
| 🟢 **WiFi Terhubung** | Heartbeat | 100ms ON, 900ms OFF |
| 🔴 **WiFi Tidak Terhubung** | Slow Blink | 1000ms ON, 1000ms OFF |
| 🟠 **Sensor Error** | Rapid Blink | 100ms ON, 100ms OFF |

---

## 16. Troubleshooting

### ESP32 Tidak Bisa Connect WiFi

1. Periksa credentials di `wifi_manager.h`
2. Pastikan SSID terlihat — ESP32 hanya mendukung **2.4GHz**, bukan 5GHz
3. Cek jarak — pastikan ESP32 dalam jangkauan router
4. Serial monitor — lihat pesan error dari WiFi Manager
5. Restart — jalankan perintah `restart` via serial

### ESP32 Tidak Upload Data ke Server

1. Cek `GAS_SCRIPT_URL` di `config.h` — harus URL lengkap dengan `/exec`
2. Cek `DEVICE_API_KEY` — harus sama persis dengan `Config_.gs`
3. Test URL manual — buka URL Web App di browser untuk verifikasi
4. Cek koneksi internet — pastikan WiFi terhubung ke internet
5. Serial monitor — lihat log upload, cari error message

### Data Sensor Tidak Muncul di Dashboard

1. Buka Google Sheets — cek apakah ada data baru masuk di sheet `sensor_data`
2. Cek trigger — pastikan ESP32 upload berhasil (serial monitor)
3. Buka dashboard — refresh halaman dashboard
4. Cek console browser — `F12` → Console, lihat error
5. Cek API URL — pastikan `js/api.js` menggunakan URL Web App yang benar

### Relay Tidak Merespon

1. Cek wiring 74HC595 — pastikan DS, SH_CP, ST_CP terhubung ke pin yang benar
2. Cek power relay — pastikan relay module mendapat power yang cukup (5V)
3. Cek OE pin — harus LOW untuk mengaktifkan output
4. Test manual — gunakan perintah serial `relay 1 on` untuk testing
5. Cek active-LOW — relay ON saat output shift register LOW

### Sensor I2C Tidak Terdeteksi

1. Cek wiring I2C — SDA ke GPIO21, SCL ke GPIO22
2. Pull-up resistor — tambahkan 4.7kΩ pada SDA & SCL ke VCC
3. Scan I2C — gunakan sketch I2C Scanner untuk verifikasi alamat
4. Cek power sensor — pastikan sensor mendapat 3.3V
5. Cek konflik alamat — pastikan tidak ada dua sensor dengan alamat yang sama

### Dashboard Error "Token Tidak Valid"

1. **Token expired** — JWT berlaku 24 jam, silakan login kembali
2. **Session dihapus** — jika admin mengubah password, semua session dihapus
3. **Ganti password** — setelah ganti password, perlu login ulang

### Setup Trigger Tidak Muncul di Dropdown GAS

Pastikan nama fungsi **tidak** diakhiri dengan underscore `_`. Contoh:

- ✅ `setupTrigger()` → muncul di dropdown
- ❌ `setupTrigger_()` → tersembunyi (GAS menganggap sebagai fungsi private)

---

## 17. Statistik Proyek

### Ringkasan Kode

| Komponen | File | Total Baris |
|----------|:----:|:-----------:|
| Google Apps Script Backend | 10 file `.gs` | 3,351 |
| Web Dashboard (PWA) | 15 file | 10,075 |
| ESP32 Firmware (Arduino IDE) | 31 file | 8,848 |
| **TOTAL** | **56 file** | **22,274** |

### Breakdown Firmware ESP32

| Modul | Header (.h) | Implementasi (.cpp) | Total |
|-------|:-----------:|:-------------------:|:-----:|
| `config.h` | 647 | — | 647 |
| `PLTS_SmartHome.ino` | — | 746 | 746 |
| `wifi_manager` | 135 | 244 | 379 |
| `api_client` | 203 | 803 | 1,006 |
| `sensor_manager` | 134 | 411 | 545 |
| `sensor_ina219` | 103 | 231 | 334 |
| `sensor_ads1115` | 117 | 292 | 409 |
| `sensor_acs712` | 112 | 256 | 368 |
| `sensor_sht31` | 98 | 182 | 280 |
| `sensor_pir` | 125 | 239 | 364 |
| `shift_register` | 173 | 255 | 428 |
| `relay_manager` | 135 | 247 | 382 |
| `pwm_ctrl` | 163 | 242 | 405 |
| `rules_engine` | 249 | 972 | 1,221 |
| `command_handler` | 141 | 378 | 519 |
| `sd_logger` | 168 | 564 | 732 |

### Google Sheets Layout

| Sheet | Fungsi | Retensi |
|-------|--------|---------|
| `sensor_data` | Data pembacaan sensor dari ESP32 | 10,080 baris (~7 hari) |
| `relay_status` | Riwayat perubahan status relay | Tidak dibatasi |
| `config` | Konfigurasi sistem (key-value) | Tidak dibatasi |
| `automation_rules` | Definisi rule otomasi | Tidak dibatasi |
| `event_log` | Log event sistem | 5,000 baris |
| `user_db` | Database pengguna | Tidak dibatasi |
| `session_db` | Sesi login aktif | Auto-cleanup 6 jam |

### Catatan Penting

> 🔐 **Password** disimpan sebagai SHA-256 hash — tidak ada password plaintext di manapun dalam sistem.

> ⏱️ **JWT token** berlaku 24 jam — user harus login ulang setelah expired.

> 📴 **ESP32 berjalan secara lokal** — meski tanpa internet, rules engine dan sensor tetap berfungsi.

> 📊 **Data sensor** di-retensi 7 hari di Google Sheets (10,080 baris × interval 1 menit).

> ⏳ **Long poll 10 detik** — ini adalah delay maksimum dari dashboard ke relay ON/OFF.

> 🛡️ **Boot safety 2 detik** — relay dibiarkan OFF selama 2 detik pertama setelah power-on.

> 🔄 **Hardware watchdog 60 detik** — ESP32 akan auto-restart jika firmware hang.

# Motion Control Alternatives for Low-Cost AOI

您目前使用 **FluidNC (ESP32)**，這是一個非常優秀的選擇。但根據開發需求與硬體取得性，以下是其他可行的替代方案比較。

## 1. Klipper (推薦替代)
**架構**: Raspberry Pi (上位機) + 任何 MCU (下位機)
Klipper 是目前 3D 列印界的主流，但也非常適合 CNC/AOI。它的特色是**將運算負載全移交給 Raspberry Pi**，MCU 只負責執行簡單的步進指令。

*   **優點**:
    *   **完美利用 Pi 5**: 您的 Pi 5 效能極強，跑 Klipper 游刃有餘。
    *   **硬體彈性大**: 下位機可以是任何便宜板子 (Arduino, STM32, RP2040, 甚至舊的 RAMPS)。
    *   **Config 修改免編譯**: 所有參數 (電流、步數、腳位) 都在 `printer.cfg` 文字檔設定，重啟即生效。
    *   **網頁介面**: 搭配 Mainsail/Fluidd，擁有現代化的 Web UI。
*   **缺點**:
    *   原本針對 3D 列印設計，CNC 功能 (如 G54 座標系) 可能需要外掛 Macro。

## 2. GRBL (經典方案)
**架構**: Arduino Uno + CNC Shield
這是最經典、成本最低的方案。

*   **優點**:
    *   **成本極低**: 板子 + Shield 可能不到 $500 TWD。
    *   **軟體支援廣**: 幾乎所有開源 CNC 軟體 (Universal Gcode Sender, Candle) 都原生支援。
    *   **穩定簡單**: 功能單純，穩定性高。
*   **缺點**:
    *   **8-bit 限制**: 脈波頻率較低，跑高速或高細分 (Microstepping) 時可能會卡頓。
    *   **功能固化**: 修改設定不像 FluidNC/Klipper 這麼方便。

## 3. Marlin (3D 印表機主板)
**架構**: BIGTREETECH SKR Mini / MKS Gen L
如果您手邊有閒置的 3D 印表機主板，可以直接刷 Marlin 來跑 CNC。

*   **優點**:
    *   **便宜的 32-bit 硬體**: 海量生產的 3D 列印主板 (如 SKR Mini E3) 性價比極高，內建靜音驅動 (TMC2209)。
    *   **Standalone**: 可以不接 Pi，直接用螢幕 + SD 卡操作。
*   **缺點**:
    *   **G-Code 支援度**: Marlin 對標準 CNC G-Code 的支援度不如 GRBL/FluidNC 完整。
    *   **修改需編譯**: 改 firmware 參數通常需要用 VS Code 重新編譯刷寫。

---

## 綜合比較表

| 特性 | **FluidNC (目前方案)** | **Klipper** | **GRBL (Arduino)** | **Marlin** |
| :--- | :--- | :--- | :--- | :--- |
| **核心晶片** | ESP32 | Pi + 任意 MCU | ATmega328 (8-bit) | STM32 / LPC |
| **成本** | 中 ($500-800) | 低 (若已有 MCU) | 極低 ($300-500) | 低 ($500-1000) |
| **運算能力** | 高 (32-bit 雙核) | 極高 (Pi CPU) | 低 | 中 (32-bit) |
| **設定方式** | YAML (免編譯) | Config (免編譯) | 編譯/參數指令 | 重新編譯 |
| **Web 介面** | 內建 (陽春) | 外掛 (Mainsail, 華麗) | 無 (需上位機) | 無 (需上位機) |
| **AOI 推薦度** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐ |

### 結論
如果您想換掉 FluidNC，**Klipper** 是最強大的替代方案，特別是因為您已經有了 Raspberry Pi 5。它可以讓您的架構更現代化，且利用 Pi 的算力來達到極致的運動平滑度。但若追求極致簡單與標準 CNC 相容性，維持 **FluidNC** 仍是最佳解。

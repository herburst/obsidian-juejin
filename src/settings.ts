import {App, PluginSettingTab, Setting} from "obsidian";
import MyPlugin from "./main";
import JueJinPlugin from "./main";

export interface JueJinSetting {
	annexPath: string;
	localAnnex: boolean;
}

export const DEFAULT_SETTINGS: JueJinSetting = {
	annexPath: "",
	localAnnex: false
}

export class JueJinSettingTab extends PluginSettingTab {
	plugin: JueJinPlugin;

	constructor(app: App, plugin: JueJinPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl} = this;
		const folders = this.app.vault.getAllFolders(true).map(f => f.path)
		containerEl.empty();
		containerEl.createEl("h2", {text: "掘金文章助手"});
		new Setting(containerEl)
			.setName("附件本地化")
			.setDesc("获取文章时，是否将文章中包含的网络资源下载到本地文件夹")
			.addToggle(toggle => {
				toggle.setValue(this.plugin.settings.localAnnex)
					.onChange(async (value) => {
						this.plugin.settings.localAnnex = value;
						await this.plugin.saveSettings();
					})
			})
		new Setting(containerEl)
			.setName("附件存储文件夹路径")
			.setDesc("指定下载附件时的存储文件夹路径")
			.addDropdown(dropdown => {
				folders.forEach(folder => {
					dropdown.addOption(folder, folder);
				})
				dropdown.setValue(this.plugin.settings.annexPath)
					.onChange(async (value) => {
						this.plugin.settings.annexPath = value;
						await this.plugin.saveSettings();
					});
			})
	}
}

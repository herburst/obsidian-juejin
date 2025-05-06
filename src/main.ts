import { App, Editor, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting, requestUrl, TFile } from 'obsidian';
// @ts-ignore
import TurndownService from 'turndown';
import {gfm} from 'turndown-plugin-gfm';
import {DEFAULT_SETTINGS, JueJinSetting, JueJinSettingTab} from "./settings";
import * as cheerio from "cheerio";
import Root = cheerio.Root;
import {v4 as uuidv4} from 'uuid'

export default class JueJinPlugin extends Plugin {
	settings: JueJinSetting;

	async onload() {
		await this.loadSettings();

		this.registerEvent(
			this.app.workspace.on("file-menu", (menu, file) => {
				menu.addItem((item) => {
					item
						.setTitle("获取掘金文章")
						.setIcon("document")
						.onClick(async () => {
							let path = file instanceof TFile ? file.parent!.path : file.path;
							new JueJinModal(this.app, path, this.settings).open()
						});
				});
			})
		);

		this.addSettingTab(new JueJinSettingTab(this.app, this));
	}

	onunload() {

	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}

class JueJinModal extends Modal {

	articleId: string;
	path: string;
	jueJinSetting: JueJinSetting;
	turndownService: TurndownService;

	constructor(app: App, path: string, jueJinSetting: JueJinSetting) {
		super(app);
		this.path = path;
		this.jueJinSetting = jueJinSetting;
		this.turndownService = new TurndownService({
			codeBlockStyle: 'fenced',
			headingStyle: 'atx'
		});
		this.turndownService.remove('style')
		gfm(this.turndownService)
	}

	onOpen() {
		const {contentEl} = this;
		contentEl.createEl("h1", {text: "获取掘金文章"});

		new Setting(contentEl).setName("文章id").addText((text) => {
			text.setValue(this.articleId).onChange((value) => {
				this.articleId = value
			})
		})

		new Setting(contentEl).addButton((button) => {
			button.setButtonText("提交").setCta().onClick(() => {
				if (!this.articleId?.trim()) {
					new Notice("请输入文章id");
					return;
				}

				requestUrl({
					url: 'https://juejin.cn/post/' + this.articleId,
					method: 'GET'
				}).then((response) => {
					let $ = cheerio.load(response.text);
					return this.solveArticle($)
				}).catch((error) => {
					console.log(error)
					new Notice("获取掘金文章失败，请检查文章id")
				})
				this.close();
			})
		})
	}

	onClose() {
		const {contentEl} = this;
		contentEl.empty();
	}

	async solveArticle($: Root) {
		let body = cheerio.load($('div#article-root')?.html()!)
		await this.downloadAnnex(body)
		let markdown = this.turndownService.turndown(body.html())
		await this.app.vault.create(`${this.path}/${$('h1.article-title')?.text().trim().replace(/[*"\\/<>:|?]/g, ' ')}.md`, markdown)
		new Notice("获取掘金文章成功！")
	}

	async downloadAnnex($: Root) {
		if (!this.jueJinSetting.localAnnex || !this.jueJinSetting.annexPath?.trim()) {
			return $;
		}

		let imgEls = $('img').toArray();
		let downloadQueue = imgEls.map(async (img) => {
			let src = $(img).attr('src')!;
			let alt = $(img).attr('alt')!
			return requestUrl({
				url: src,
				method: 'GET'
			}).then((response) => {
				let suffix = alt === '' ? '.png' : alt.match(/\.[a-zA-Z0-9]+$/)![0];
				let localName = `${this.jueJinSetting.annexPath}/${uuidv4()}${suffix}`;
				this.app.vault.createBinary(localName, response.arrayBuffer)
				return {src, localName};
			})
		})
		let downloadResults = await Promise.all(downloadQueue);
		let pathMapping = new Map(downloadResults.map(r => [r.src, r.localName]))
		$('img').each((index, img) => {
			let src = $(img).attr('src')!;
			$(img).attr('src', pathMapping.get(src)!)
		})
	}
}

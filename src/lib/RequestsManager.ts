import { Spinner } from 'clui';
import cheerio from "cheerio";
import CubedFileManager from "../CubedFileManager";
import fetch from 'node-fetch';
import getSkriptErrors from '../util/getSkriptErrors';

export default class RequestManager {
	
	private instance: CubedFileManager;

	constructor(instance: CubedFileManager) {
		this.instance = instance;
	}

	/**
	 * Methods used for file stuff
	 */

	/**
	 * Create a file on the dashboard
	 * @param name The name of te file
	 * @param content The content of the file
	 * @param rawPath The path to the file in the file manager
	 * @returns Promise that resolves when the file is made
	 */
	public createFile(name: string, content: string = "", rawPath: string) : Promise<void> {
		return new Promise(async (resolve) => {
			const headers = this.instance.headers;

			let path: string;
			const spin = new Spinner(`Creating file ${name}...`);

			if (this.instance.folderSupport && rawPath.length > 0) {
				let normalpath = rawPath.split('\\')
				path = normalpath.slice(0, normalpath.length - 1).join('/');
			} else {
				path = rawPath;
			}

			const url = `https://playerservers.com/dashboard/filemanager/?action=new&dir=/${this.instance.baseDir}/${path}/`;
			spin.start();
			await fetch(url, { headers: headers as any })
			.then((res) => res.text())
			.then(async (html) => {	
				/**
				 * First fetch is to get the edit token
				 */
		
				const fileExtension = getFileExtension(name);
				const replacement = "." + fileExtension;
				const fileName = name.replace(replacement, "");
		
				const $ = cheerio.load(html);
				const editToken = $("input[name=token]").val();
		
				const params = new URLSearchParams();
				params.append("token", editToken as string);
				params.append("edit-file-name", fileName);
				params.append("edit-file-content", content);
				params.append("edit-file-sub", "Save");
				params.append("ext", fileExtension);

				console.log(editToken);
		
				/**
				 * Fetching a second time to actually make the file
				 */
				
				await fetch(url, {
					method: "POST",
					headers: headers as any,
					body: params as any
				}).then(async () => {
					spin.stop();
					this.instance.message_log(`Created file ${fileName}.${fileExtension}`)

					await this.sendCommand(`sk reload ${this.instance.folderSupport ? `${path}/${name}` : name}`)
					await this.sendCommand(`sendmsgtoops &e${this.instance.username ? this.instance.username : ""} &fCreated${content.length ? " and enabled" : ""} &b${ this.instance.folderSupport ? `${path}/${name}` : name}`);
					
					resolve();
				})	
			})

		})
	}

	/**
	 * Create a folder on the dashboard
	 * @param dir The directory the folder has to be made in
	 * @param dirName The name of the folder
	 * @returns Promise that resolves when the folder is made
	 */
	public createFolder(dir: string, dirName: string) : Promise<void> {
		return new Promise(async (resolve) => {
			const headers = this.instance.headers;
			const spin = new Spinner('Creating new folder');
			
			/**
			 * First fetch is to get the token
			 */
			spin.start();
			const url = `https://playerservers.com/dashboard/filemanager/?action=new_folder&dir=/${this.instance.baseDir}${dir}`;
				
			await fetch(url, { headers: headers as any })
			.then((res) => res.text())
			.then(async (html) => {
			
				const $ = cheerio.load(html);
				const editToken = $("input[name=token]").val();
			
				const params = new URLSearchParams();
				params.append("new-folder-name", dirName);
				params.append("token", editToken as string);
				params.append("edit-file-sub", "Save");
			
				/**
				 * Fetching a second time to create the actual directory
				 */
			
				await fetch(url, {
					method: "POST",
					headers: headers as any,
					body: params as any
				}).then((e) => {
					spin.stop();
					this.instance.message_log(`Created folder ${dirName}`);
					resolve();
				})
			})
		}) 
	}

	/**
	 * 
	 * @param name The name of the file
	 * @param content The content of the file
	 * @param rawPath The path to the file in the file manager
	 */
	public editFile(name: string, content: string, rawPath: string) : Promise<void> {
		return new Promise(async (resolve) => {
			const headers = this.instance.headers;

			let path: string;
			const spin = new Spinner(`Editing file ${name}...`);

			if (this.instance.folderSupport && rawPath.length > 0) {
				let normalpath = rawPath.split('\\')
				path = normalpath.slice(0, normalpath.length - 1).join('/');
			} else {
				path = rawPath;
			}

			const url = `https://playerservers.com/dashboard/filemanager/&action=edit&medit=/${this.instance.baseDir}/${path}/${name}&dir=/${this.instance.baseDir}/${path}`;
			spin.start();

			await fetch(url, {
				headers: headers as any,
			})
			.then((res) => res.text())	
			.then(async (html) => {
			
				/**
				 * First fetch for getting edit token
				 */
		
				const fileExtension = getFileExtension(name);
				const fileName = name.replace(("." + fileExtension), '');
		
				const $ = cheerio.load(html);
				const editToken = $("input[name=token]").val();
		
				const params = new URLSearchParams();
				params.append("token", editToken as string);
				params.append("edit-file-name", fileName);
				params.append("edit-file-content", content);
				params.append("edit-file-sub", "Save");

				await fetch(url, {
					method: "POST",
					headers: headers as any,
					body: params as any,
				}).then(async () => {
					spin.stop();
					this.instance.message_log(`Edited file ${name}`);
					await this.sendCommand(`sendmsgtoops &e${this.instance.username ? this.instance.username : ""} &fSaved file &b${this.instance.folderSupport ? `${path}/${name}` : name}`);
					await this.sendCommand(`sk reload ${this.instance.folderSupport ? `${path}/${name}` : name}`)
					await this.sendCommand(`sendmsgtoops &e${this.instance.username ? this.instance.username : ""} &fReloaded file &b${this.instance.folderSupport ? `${path}/${name}` : name}`);
					
					if (!this.instance.settingsManager.settings?.logErrors) return resolve();

					const console_content = await this.getConsoleContent();
					console.log(console_content);
					const skript_errors = getSkriptErrors(console_content, name);

					if (skript_errors) {		
						this.instance.message_error('Encountered an error when reloading ' + name);
						this.instance.message_error(skript_errors['data'].replace('\n', ""));
						this.instance.message_error(`Script reloaded with ${skript_errors.errors} errors`);
					}

					resolve();
				})
			})
		})
	}

	/**
	 * Check if a folder exists on the file manager
	 * @param dir The directory to check
	 * @returns Promise that resolves with a boolean that is true if the folder exists and false if it doesn't
	 */
	public folderExists(dir: string) : Promise<boolean> {
		return new Promise(async (resolve) => {
			const headers = this.instance.headers
			
			const url = `https://playerservers.com/dashboard/filemanager/&dir=/${this.instance.baseDir}${dir}`;
			await fetch(url, { headers: headers as any })
			.then((res) => res.text())
			.then(async (html) => {
				if (html.includes(`window.location.replace("/dashboard/filemanager")`)) {
					resolve(false);
				}
				resolve(true);
			})
		})
	}

	public getConsoleContent() : Promise<string> {
		return new Promise(async (resolve) => {
			const headers = this.instance.headers;
			const url = `https://playerservers.com/dashboard/console-backend/`
		
			const data = await fetch(url, {
				headers: headers as any,
			}).then((res) => res.text());

			resolve(data);
		})
	}

	/**
	 *  Methods used for logging in
	 */

	/**
	 * Log into an account and get a session ID in return if the login was successful
	 * @param username The username to login with
	 * @param password The password to login with
	 * @returns Promise that resolves with the phpsessid token
	 */
	public login(username: string, password: string) : Promise<string|null> {
		return new Promise(async(resolve) => {
			const url = 'https://playerservers.com/login';
			await fetch(url)
			.then(async (res) => {
				const html = await res.text();
				const $ = cheerio.load(html);
				const requestToken = $("input[name=token]").val();
				
				const cookie = (res.headers as any)
				.raw()
				["set-cookie"].find((s: string) => s.startsWith("PHPSESSID"))
				.split(";")[0]
				.split("=")[1];

				const params = new URLSearchParams();
				params.append('username', username);
				params.append('password', password);
				params.append('token', requestToken as string);

				const success = await fetch(url, {
					method: 'POST',
					body: params as any,
					headers: {
						cookie: `PHPSESSID=${cookie};`
					}
				})
				.then((res) => res.text())
				.then((html) => html.includes(`replace("/dashboard/")`))
				.catch(e => console.log(e));

				if (success) {
					this.instance.message_success(`Logged in as ${username}`)
					resolve(cookie);
				} else {
					this.instance.message_error(`Failed to log in as ${username}`)
					resolve(null);
				}
			})
		});
	}

	/**
	 * Get all servers the user has access to on their file manager
	 * @returns Array of all servers the user has access to
	 */
	public getServersInDashboard() : Promise<{ name: string, id: number }[]>{
		return new Promise(async (resolve) => {
			const headers = this.instance.headers;
			const url = 'https://playerservers.com/account';
			await fetch(url, {
				headers: headers as any
			})
			.then((res) => res.text())
			.then(async (html) => {
				
				const links = [];
				const names: string[] = [];
				const hrefs: string[] = [];
	
				const $ = cheerio.load(html);
				$('tr > td:nth-child(1)').each((index, element) => {
					const name = $(element).text();
					names.push(name);
				})
	
				$('tr > td:nth-child(6) > a').each((index, element) => {
					const href = $(element).attr('href');
					if (href) {
						hrefs.push(href);
					}
				})
	
				for (let i = 0; i < names.length; i++) {
					const name = names[i];
					const id = parseInt(hrefs[i].split('?s=')[1]);
	
					links.push({ name: name, id: id })
				}

				resolve(links);
			})
		})
	}

	/**
	 * Select a server to edit on the dashboard
	 * @param id The server ID to select
	 * @returns A promise that resolves when the server is selected
	 */
	public selectServer(id: number) : Promise<void> {
		return new Promise(async (resolve) => {
			const url = `https://playerservers.com/dashboard/?s=${id}`;
			await fetch(url, {
				headers: this.instance.headers as any
			})
			resolve();
		})
	}

	/**
	 * Check if the session token has expired
	 * @returns A promise that resolves with a boolean that indicates if the session is expired
	 */
	public sessionIsExpired() : Promise<boolean> {
		return new Promise(async (resolve) => {
			const url = `https://playerservers.com/dashboard/}`;
			resolve(await fetch(url, {
				headers: this.instance.headers as any
			})
			.then((res) => res.text())
			.then((res) => res.includes('/login/')));
		})
	}

	/**
	 * Send a command to the server
	 * @param cmd The command to send to the server
	 * @returns A promise that resolves once the command has been sent
	 */
	public sendCommand(cmd: string) : Promise<void> {
		return new Promise(async (resolve) => {
			const headers = this.instance.headers
			const url = `https://playerservers.com/dashboard/console-backend/`
		
			const params = new URLSearchParams();
			params.append("sendcmd", cmd);
			await fetch(url, {
				method: "POST",
				headers: headers as any,
				body: params as any
			});
			resolve();
		})
	}

	/**
	 * Check if a session needs to be updated or not
	 * @returns A promise that resolves once the session has been checked and renewed if neccesary
	 */
	public checkAndUpdateSession() : Promise<void> {
		return new Promise(async (resolve) => {
			const isExpired = await this.sessionIsExpired();

			if (isExpired) {
				const token = await this.login(this.instance.temp_username!, this.instance.temp_password!);
				this.instance.sessionToken = token!;
				await this.selectServer(this.instance.temp_server!);
			}
			resolve();
		})
	}
}

/**
 * Get the file extension of a file
 * @param fname The file name
 * @returns The file extension
 */
function getFileExtension(fname: string) {
	return fname.slice((Math.max(0, fname.lastIndexOf(".")) || Infinity) + 1);
}

module.exports = function (json, callback) {
	// if we have no usage of hyperloop just return
	if (!json) { return callback(); }
	// map in our TiApp file
	json.classes.TiApp = {
		framework: 'Titanium',
		name: 'TiApp',
		methods: {
			app: {
				instance: false,
				name: 'app',
				arguments: [],
				selector: 'app',
				returns: {
					type: 'obj_interface',
					encoding: '@',
					value: 'TiApp *'
				}
			},
			showModalController: {
				instance: true,
				name: 'showModalController',
				selector: 'showModalController:animated:',
				arguments: [
					{
						type: 'obj_interface',
						encoding: '@',
						value: 'UIViewController *',
						name: 'controller'
					},
					{
						type: 'bool',
						encoding: 'B',
						value: 'BOOL',
						name: 'animated'
					}
				],
				returns: {
					type: 'void',
					encoding: 'v',
					value: 'void'
				}
			},
			hideModalController: {
				instance: true,
				name: 'hideModalController',
				selector: 'hideModalController:animated:',
				arguments: [
					{
						type: 'obj_interface',
						encoding: '@',
						value: 'UIViewController *',
						name: 'controller'
					},
					{
						type: 'bool',
						encoding: 'B',
						value: 'BOOL',
						name: 'animated'
					}
				],
				returns: {
					type: 'void',
					encoding: 'v',
					value: 'void'
				}
			},
			showModalError: {
				instance: true,
				name: 'showModalError',
				selector: 'showModalError:',
				arguments: [
					{
						type: 'obj_interface',
						encoding: '@',
						value: 'NSString *'
					}
				],
				returns: {
					type: 'void',
					encoding: 'v',
					value: 'void'
				}
			},
			startNetwork: {
				instance: true,
				name: 'startNetwork',
				selector: 'startNetwork',
				arguments: [],
				returns: {
					type: 'void',
					encoding: 'v',
					value: 'void'
				}
			},
			stopNetwork: {
				instance: true,
				name: 'stopNetwork',
				selector: 'stopNetwork',
				arguments: [],
				returns: {
					type: 'void',
					encoding: 'v',
					value: 'void'
				}
			},
			registerApplicationDelegate: {
				instance: true,
				name: 'registerApplicationDelegate',
				selector: 'registerApplicationDelegate',
				arguments: [
					{
						type: 'id',
						encoding: '@',
						value: 'id',
						name: 'delegate'
					}
				],
				returns: {
					type: 'void',
					encoding: 'v',
					value: 'void'
				}
			},
			unregisterApplicationDelegate: {
				instance: true,
				name: 'unregisterApplicationDelegate',
				selector: 'unregisterApplicationDelegate',
				arguments: [
					{
						type: 'id',
						encoding: '@',
						value: 'id',
						name: 'delegate'
					}
				],
				returns: {
					type: 'void',
					encoding: 'v',
					value: 'void'
				}
			}
		},
		properties: {
			userAgent: {
				name: 'userAgent',
				attributes: ['readonly'],
				type: {
					type: 'obj_interface',
					encoding: '@',
					value: 'NSString *'
				}
			},
			window: {
				name: 'window',
				attributes: ['readonly'],
				type: {
					type: 'obj_interface',
					encoding: '@',
					value: 'UIWindow *'
				}
			},
			remoteDeviceUUID: {
				name: 'remoteDeviceUUID',
				attributes: ['readonly'],
				type: {
					type: 'obj_interface',
					encoding: '@',
					value: 'NSString *'
				}
			},
			remoteNotification: {
				name: 'remoteNotification',
				attributes: ['readonly'],
				type: {
					type: 'obj_interface',
					encoding: '@',
					value: 'NSDictionary *'
				}
			},
			localNotification: {
				name: 'localNotification',
				attributes: ['readonly'],
				type: {
					type: 'obj_interface',
					encoding: '@',
					value: 'NSDictionary *'
				}
			},
			launchOptions: {
				name: 'launchOptions',
				attributes: ['readonly'],
				type: {
					type: 'obj_interface',
					encoding: '@',
					value: 'NSDictionary *'
				}
			},
			windowIsKeyWindow: {
				name: 'windowIsKeyWindow',
				attributes: ['readonly'],
				type: {
					type: 'bool',
					encoding: 'B',
					value: 'BOOL'
				}
			},
			controller: {
				name: 'controller',
				returns: {
					type: 'obj_interface',
					encoding: '@',
					value: 'UIViewController *'
				}
			},
			userAgent: {
				name: 'userAgent',
				returns: {
					type: 'obj_interface',
					encoding: '@',
					value: 'NSString *'
				}
			},
			sessionId: {
				name: 'sessionId',
				returns: {
					type: 'obj_interface',
					encoding: '@',
					value: 'NSString *'
				}
			}
		}
	};
	callback();
}

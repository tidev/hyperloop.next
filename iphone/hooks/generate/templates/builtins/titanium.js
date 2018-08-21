module.exports = function(json, callback) {
	// if we have no usage of Hyperloop, just return
	if (!json) {
		return callback();
	}

	json.classes.TiApp = {
		framework: 'Titanium',
		name: 'TiApp',
		methods: {

			/* Class Methods */

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
			getController: {
				instance: false,
				name: 'getController',
				arguments: [],
				selector: 'controller',
				returns: {
					type: 'obj_interface',
					encoding: '@',
					value: 'UIViewController *'
				}
			},
			getTiAppProperties: {
				instance: false,
				name: 'getTiAppProperties',
				arguments: [],
				selector: 'tiAppProperties',
				returns: {
					type: 'obj_interface',
					encoding: '@',
					value: 'NSDictionary *'
				}
			},

			/* Instance Methods */

			showModalController: {
				instance: true,
				name: 'showModalController',
				selector: 'showModalController:animated:',
				arguments: [{
					type: 'obj_interface',
					encoding: '@',
					value: 'UIViewController *',
					name: 'controller'
				}, {
					type: 'bool',
					encoding: 'B',
					value: 'BOOL',
					name: 'animated'
				}],
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
				arguments: [{
					type: 'obj_interface',
					encoding: '@',
					value: 'UIViewController *',
					name: 'controller'
				}, {
					type: 'bool',
					encoding: 'B',
					value: 'BOOL',
					name: 'animated'
				}],
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
				arguments: [{
					type: 'obj_interface',
					encoding: '@',
					value: 'NSString *'
				}],
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
				selector: 'registerApplicationDelegate:',
				arguments: [{
					type: 'id',
					encoding: '@',
					value: 'id',
					name: 'delegate'
				}],
				returns: {
					type: 'void',
					encoding: 'v',
					value: 'void'
				}
			},
			unregisterApplicationDelegate: {
				instance: true,
				name: 'unregisterApplicationDelegate',
				selector: 'unregisterApplicationDelegate:',
				arguments: [{
					type: 'id',
					encoding: '@',
					value: 'id',
					name: 'delegate'
				}],
				returns: {
					type: 'void',
					encoding: 'v',
					value: 'void'
				}
			},
			windowIsKeyWindow: {
				instance: true,
				name: 'getWindowIsKeyWindow',
				selector: 'windowIsKeyWindow',
				arguments: [],
				returns: {
					type: 'bool',
					encoding: 'b',
					value: 'BOOL'
				}
			},
			getRemoteDeviceUUID: {
				instance: true,
				name: 'getRemoteDeviceUUID',
				selector: 'remoteDeviceUUID',
				arguments: [],
				returns: {
					type: 'obj_interface',
					encoding: '@',
					value: 'NSString *'
				}
			},
			getSessionId: {
				instance: true,
				name: 'getSessionId',
				selector: 'sessionId',
				arguments: [],
				returns: {
					type: 'obj_interface',
					encoding: '@',
					value: 'NSString *'
				}
			},
			getLaunchOptions: {
				instance: true,
				name: 'getLaunchOptions',
				selector: 'launchOptions',
				arguments: [],
				returns: {
					type: 'obj_interface',
					encoding: '@',
					value: 'NSDictionary *'
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
			}
		}
	};
	callback();
}

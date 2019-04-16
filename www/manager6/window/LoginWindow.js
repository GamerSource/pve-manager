/*global u2f*/
Ext.define('PVE.window.LoginWindow', {
    extend: 'Ext.window.Window',

    controller: {

	xclass: 'Ext.app.ViewController',

	onLogon: function() {
	    var me = this;

	    var form = this.lookupReference('loginForm');
	    var unField = this.lookupReference('usernameField');
	    var saveunField = this.lookupReference('saveunField');
	    var view = this.getView();

	    if (!form.isValid()) {
		return;
	    }

	    view.el.mask(gettext('Please wait...'), 'x-mask-loading');

	    // set or clear username
	    var sp = Ext.state.Manager.getProvider();
	    if (saveunField.getValue() === true) {
		sp.set(unField.getStateId(), unField.getValue());
	    } else {
		sp.clear(unField.getStateId());
	    }
	    sp.set(saveunField.getStateId(), saveunField.getValue());

	    form.submit({
		failure: function(f, resp){
		    me.failure(resp);
		},
		success: function(f, resp){
		    view.el.unmask();

		    var data = resp.result.data;
		    if (Ext.isDefined(data.NeedTFA)) {
			// Store first factor login information first:
			data.LoggedOut = true;
			Proxmox.Utils.setAuthData(data);

			if (Ext.isDefined(data.U2FChallenge)) {
			    me.perform_u2f(data);
			} else {
			    me.perform_otp();
			}
		    } else {
			me.success(data);
		    }
		}
	    });

	},
	failure: function(resp) {
	    var me = this;
	    var view = me.getView();
	    view.el.unmask();
	    var handler = function() {
		var uf = me.lookupReference('usernameField');
		uf.focus(true, true);
	    };

	    Ext.MessageBox.alert(gettext('Error'),
				 gettext("Login failed. Please try again"),
				 handler);
	},
	success: function(data) {
	    var me = this;
	    var view = me.getView();
	    var handler = view.handler || Ext.emptyFn;
	    handler.call(me, data);
	    view.close();
	},

	perform_otp: function() {
	    var me = this;
	    var win = Ext.create('PVE.window.TFALoginWindow', {
		onLogin: function(value) {
		    me.finish_tfa(value);
		},
		onCancel: function() {
		    Proxmox.LoggedOut = false;
		    Proxmox.Utils.authClear();
		    me.getView().show();
		}
	    });
	    win.show();
	},

	perform_u2f: function(data) {
	    var me = this;
	    // Show the message:
	    var msg = Ext.Msg.show({
		title: 'U2F: '+gettext('Verification'),
		message: gettext('Please press the button on your U2F Device'),
		buttons: []
	    });
	    var chlg = data.U2FChallenge;
	    var key = {
		version: chlg.version,
		keyHandle: chlg.keyHandle
	    };
	    u2f.sign(chlg.appId, chlg.challenge, [key], function(res) {
		msg.close();
		if (res.errorCode) {
		    Proxmox.Utils.authClear();
		    Ext.Msg.alert(gettext('Error'), PVE.Utils.render_u2f_error(res.errorCode));
		    return;
		}
		delete res.errorCode;
		me.finish_tfa(JSON.stringify(res));
	    });
	},
	finish_tfa: function(res) {
	    var me = this;
	    var view = me.getView();
	    view.el.mask(gettext('Please wait...'), 'x-mask-loading');
	    var params = { response: res };
	    Proxmox.Utils.API2Request({
		url: '/api2/extjs/access/tfa',
		params: params,
		method: 'POST',
		timeout: 5000, // it'll delay both success & failure
		success: function(resp, opts) {
		    view.el.unmask();
		    // Fill in what we copy over from the 1st factor:
		    var data = resp.result.data;
		    data.CSRFPreventionToken = Proxmox.CSRFPreventionToken;
		    data.username = Proxmox.UserName;
		    // Finish logging in:
		    me.success(data);
		},
		failure: function(resp, opts) {
		    Proxmox.Utils.authClear();
		    me.failure(resp);
		}
	    });
	},

	control: {
	    'field[name=username]': {
		specialkey: function(f, e) {
		    if (e.getKey() === e.ENTER) {
			var pf = this.lookupReference('passwordField');
			if (!pf.getValue()) {
			    pf.focus(false);
			}
		    }
		}
	    },
	    'field[name=lang]': {
		change: function(f, value) {
		    var dt = Ext.Date.add(new Date(), Ext.Date.YEAR, 10);
		    Ext.util.Cookies.set('PVELangCookie', value, dt);
		    this.getView().mask(gettext('Please wait...'), 'x-mask-loading');
		    window.location.reload();
		}
	    },
            'button[reference=loginButton]': {
		click: 'onLogon'
            },
	    '#': {
		show: function() {
		    var sp = Ext.state.Manager.getProvider();
		    var checkboxField = this.lookupReference('saveunField');
		    var unField = this.lookupReference('usernameField');

		    var checked = sp.get(checkboxField.getStateId());
		    checkboxField.setValue(checked);

		    if(checked === true) {
			var username = sp.get(unField.getStateId());
			unField.setValue(username);
			var pwField = this.lookupReference('passwordField');
			pwField.focus();
		    }
		}
	    }
	}
    },

    width: 400,

    modal: true,

    border: false,

    draggable: true,

    closable: false,

    resizable: false,

    layout: 'auto',

    title: gettext('Proxmox VE Login'),

    defaultFocus: 'usernameField',

    defaultButton: 'loginButton',

    items: [{
	xtype: 'form',
	layout: 'form',
	url: '/api2/extjs/access/ticket',
	reference: 'loginForm',

	fieldDefaults: {
	    labelAlign: 'right',
	    allowBlank: false
	},

	items: [
	    {
		xtype: 'textfield',
		fieldLabel: gettext('User name'),
		name: 'username',
		itemId: 'usernameField',
		reference: 'usernameField',
		stateId: 'login-username'
	    },
	    {
		xtype: 'textfield',
		inputType: 'password',
		fieldLabel: gettext('Password'),
		name: 'password',
		reference: 'passwordField'
	    },
	    {
		xtype: 'pveRealmComboBox',
		name: 'realm'
	    },
	    {
		xtype: 'proxmoxLanguageSelector',
		fieldLabel: gettext('Language'),
		value: Ext.util.Cookies.get('PVELangCookie') || Proxmox.defaultLang || 'en',
		name: 'lang',
		reference: 'langField',
		submitValue: false
	    }
	],
	buttons: [
	    {
		xtype: 'checkbox',
		fieldLabel: gettext('Save User name'),
		name: 'saveusername',
		reference: 'saveunField',
		stateId: 'login-saveusername',
		labelWidth: 'auto',
		labelAlign: 'right',
		submitValue: false
	    },
	    {
		text: gettext('Login'),
		reference: 'loginButton'
	    }
	]
    }]
 });
Ext.define('PVE.window.TFALoginWindow', {
    extend: 'Ext.window.Window',

    modal: true,
    resizable: false,
    title: 'Two-Factor Authentication',
    layout: 'form',
    defaultButton: 'loginButton',
    defaultFocus: 'otpField',

    controller: {
	xclass: 'Ext.app.ViewController',
	login: function() {
	    var me = this;
	    var view = me.getView();
	    view.onLogin(me.lookup('otpField').getValue());
	    view.close();
	},
	cancel: function() {
	    var me = this;
	    var view = me.getView();
	    view.onCancel();
	    view.close();
	}
    },

    items: [
	{
	    xtype: 'textfield',
	    fieldLabel: gettext('Please enter your OTP verification code:'),
	    name: 'otp',
	    itemId: 'otpField',
	    reference: 'otpField',
	    allowBlank: false
	}
    ],

    buttons: [
	{
	    text: gettext('Login'),
	    reference: 'loginButton',
	    handler: 'login'
	},
	{
	    text: gettext('Cancel'),
	    handler: 'cancel'
	}
    ]
});

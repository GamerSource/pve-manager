Ext.define('PVE.FirewallOptions', {
    extend: 'Proxmox.grid.ObjectGrid',
    alias: ['widget.pveFirewallOptions'],

    fwtype: undefined, // 'dc', 'node' or 'vm'

    base_url: undefined,

    initComponent : function() {
	/*jslint confusion: true */

	var me = this;

	if (!me.base_url) {
	    throw "missing base_url configuration";
	}

	if (me.fwtype === 'dc' || me.fwtype === 'node' || me.fwtype === 'vm') {
	    if (me.fwtype === 'node') {
		me.cwidth1 = 250;
	    }
	} else {
	    throw "unknown firewall option type";
	}

	me.rows = {};

	var add_boolean_row = function(name, text, defaultValue) {
	    me.add_boolean_row(name, text, { defaultValue: defaultValue });
	};
	var add_integer_row = function(name, text, minValue, labelWidth) {
	    me.add_integer_row(name, text, {
		minValue: minValue,
		deleteEmpty: true,
		labelWidth: labelWidth,
		renderer: function(value) {
		    if (value === undefined) {
			return Proxmox.Utils.defaultText;
		    }

		    return value;
		}
	    });
	};

	var add_log_row = function(name, labelWidth) {
	    me.rows[name] = {
		header: name,
		required: true,
		defaultValue: 'nolog',
		editor: {
		    xtype: 'proxmoxWindowEdit',
		    subject: name,
		    fieldDefaults: { labelWidth: labelWidth || 100 },
		    items: {
			xtype: 'proxmoxKVComboBox',
			name: name,
			fieldLabel: name,
			comboItems: [['nolog', 'nolog'], ['info', 'info'], ['err', 'err'],
			       ['warning', 'warning'], ['crit', 'crit'], ['alert', 'alert'],
			       ['emerg', 'emerg'], ['debug', 'debug']]
		    }
		}
	    };
	};


	if (me.fwtype === 'node') {
	    add_boolean_row('enable', gettext('Firewall'), 1);
	    add_boolean_row('nosmurfs', gettext('SMURFS filter'), 1);
	    add_boolean_row('tcpflags', gettext('TCP flags filter'), 0);
	    add_boolean_row('ndp', 'NDP', 1);
	    add_integer_row('nf_conntrack_max', 'nf_conntrack_max', 32768, 120);
	    add_integer_row('nf_conntrack_tcp_timeout_established',
			    'nf_conntrack_tcp_timeout_established', 7875, 250);
	    add_log_row('log_level_in');
	    add_log_row('log_level_out');
	    add_log_row('tcp_flags_log_level', 120);
	    add_log_row('smurf_log_level');
	} else if (me.fwtype === 'vm') {
	    add_boolean_row('enable', gettext('Firewall'), 0);
	    add_boolean_row('dhcp', 'DHCP', 1);
	    add_boolean_row('ndp', 'NDP', 1);
	    add_boolean_row('radv', gettext('Router Advertisement'), 0);
	    add_boolean_row('macfilter', gettext('MAC filter'), 1);
	    add_boolean_row('ipfilter', gettext('IP filter'), 0);
	    add_log_row('log_level_in');
	    add_log_row('log_level_out');
	} else if (me.fwtype === 'dc') {
	    add_boolean_row('enable', gettext('Firewall'), 0);
	    add_boolean_row('ebtables', 'ebtables', 1);
	}

	if (me.fwtype === 'dc' || me.fwtype === 'vm') {
	    me.rows.policy_in = {
		header: gettext('Input Policy'),
		required: true,
		defaultValue: 'DROP',
		editor: {
		    xtype: 'proxmoxWindowEdit',
		    subject: gettext('Input Policy'),
		    items: {
			xtype: 'pveFirewallPolicySelector',
			name: 'policy_in',
			value: 'DROP',
			fieldLabel: gettext('Input Policy')
		    }
		}
	    };

	    me.rows.policy_out = {
		header: gettext('Output Policy'),
		required: true,
		defaultValue: 'ACCEPT',
		editor: {
		    xtype: 'proxmoxWindowEdit',
		    subject: gettext('Output Policy'),
		    items: {
			xtype: 'pveFirewallPolicySelector',
			name: 'policy_out',
			value: 'ACCEPT',
			fieldLabel: gettext('Output Policy')
		    }
		}
	    };
	}

	var edit_btn = new Ext.Button({
	    text: gettext('Edit'),
	    disabled: true,
	    handler: function() { me.run_editor(); }
	});

	var set_button_status = function() {
	    var sm = me.getSelectionModel();
	    var rec = sm.getSelection()[0];

	    if (!rec) {
		edit_btn.disable();
		return;
	    }
	    var rowdef = me.rows[rec.data.key];
	    edit_btn.setDisabled(!rowdef.editor);
	};

	Ext.apply(me, {
	    url: "/api2/json" + me.base_url,
	    tbar: [ edit_btn ],
	    editorConfig: {
		url: '/api2/extjs/' + me.base_url
	    },
	    listeners: {
		itemdblclick: me.run_editor,
		selectionchange: set_button_status
	    }
	});

	me.callParent();

	me.on('activate', me.rstore.startUpdate);
	me.on('destroy', me.rstore.stopUpdate);
	me.on('deactivate', me.rstore.stopUpdate);
    }
});

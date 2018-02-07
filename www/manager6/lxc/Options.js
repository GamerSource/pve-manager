/*jslint confusion: true */
Ext.define('PVE.lxc.Options', {
    extend: 'Proxmox.grid.ObjectGrid',
    alias: ['widget.pveLxcOptions'],

    onlineHelp: 'pct_options',

    initComponent : function() {
	var me = this;
	var i;

	var nodename = me.pveSelNode.data.node;
	if (!nodename) {
	    throw "no node name specified";
	}

	var vmid = me.pveSelNode.data.vmid;
	if (!vmid) {
	    throw "no VM ID specified";
	}

	var caps = Ext.state.Manager.get('GuiCap');

	var rows = {
	    onboot: {
		header: gettext('Start at boot'),
		defaultValue: '',
		renderer: Proxmox.Utils.format_boolean,
		editor: caps.vms['VM.Config.Options'] ? {
		    xtype: 'proxmoxWindowEdit',
		    subject: gettext('Start at boot'),
		    items: {
			xtype: 'proxmoxcheckbox',
			name: 'onboot',
			uncheckedValue: 0,
			defaultValue: 0,
			fieldLabel: gettext('Start at boot')
		    }
		} : undefined
	    },
	    startup: {
		header: gettext('Start/Shutdown order'),
		defaultValue: '',
		renderer: PVE.Utils.render_kvm_startup,
		editor: caps.vms['VM.Config.Options'] && caps.nodes['Sys.Modify'] ? 
		    {
			xtype: 'pveWindowStartupEdit',
			onlineHelp: 'pct_startup_and_shutdown'
		    } : undefined
	    },
	    ostype: {
		header: gettext('OS Type'),
		defaultValue: Proxmox.Utils.unknownText
	    },
	    arch: {
		header: gettext('Architecture'),
		defaultValue: Proxmox.Utils.unknownText
	    },
	    console: {
		header: '/dev/console',
		defaultValue: 1,
		renderer: Proxmox.Utils.format_enabled_toggle,
		editor: caps.vms['VM.Config.Options'] ? {
		    xtype: 'proxmoxWindowEdit',
		    subject: '/dev/console',
		    items: {
			xtype: 'proxmoxcheckbox',
			name: 'console',
			uncheckedValue: 0,
			defaultValue: 1,
			deleteDefaultValue: true,
			checked: true,
			fieldLabel: '/dev/console'
		    }
		} : undefined
	    },
	    tty: {
		header: gettext('TTY count'),
		defaultValue: 2,
		editor: caps.vms['VM.Config.Options'] ? {
		    xtype: 'proxmoxWindowEdit',
		    subject: gettext('TTY count'),
		    items: {
			xtype: 'proxmoxintegerfield',
			name: 'tty',
			minValue: 0,
			maxValue: 6,
			value: 2,
			fieldLabel: gettext('TTY count'),
			emptyText: gettext('Default'),
			deleteEmpty: true
		    }
		} : undefined
	    },
	    cmode: {
		header: gettext('Console mode'),
		defaultValue: 'tty',
		editor: caps.vms['VM.Config.Options'] ? {
		    xtype: 'proxmoxWindowEdit',
		    subject: gettext('Console mode'),
		    items: {
			xtype: 'proxmoxKVComboBox',
			name: 'cmode',
			deleteEmpty: true,
			value: '__default__',
			comboItems: [
			    ['__default__', Proxmox.Utils.defaultText + " (tty)"],
			    ['tty', "/dev/tty[X]"],
			    ['console', "/dev/console"],
			    ['shell', "shell"]
			],
			fieldLabel: gettext('Console mode')
		    }
		} : undefined
	    },
	    protection: {
		header: gettext('Protection'),
		defaultValue: false,
		renderer: Proxmox.Utils.format_boolean,
		editor: caps.vms['VM.Config.Options'] ? {
		    xtype: 'proxmoxWindowEdit',
		    subject: gettext('Protection'),
		    items: {
			xtype: 'proxmoxcheckbox',
			name: 'protection',
			uncheckedValue: 0,
			defaultValue: 0,
			deleteDefaultValue: true,
			fieldLabel: gettext('Enabled')
		    }
		} : undefined
	    },
	    unprivileged: {
		header: gettext('Unprivileged container'),
		renderer: Proxmox.Utils.format_boolean,
		defaultValue: 0
	    }
	};

	var baseurl = 'nodes/' + nodename + '/lxc/' + vmid + '/config';

	var sm = Ext.create('Ext.selection.RowModel', {});

	var edit_btn = new Proxmox.button.Button({
	    text: gettext('Edit'),
	    disabled: true,
	    selModel: sm,
	    enableFn: function(rec) {
		var rowdef = rows[rec.data.key];
		return !!rowdef.editor;
	    },
	    handler: function() { me.run_editor(); }
	});

	Ext.apply(me, {
	    url: "/api2/json/" + baseurl,
	    selModel: sm,
	    interval: 5000,
	    tbar: [ edit_btn ],
	    rows: rows,
	    editorConfig: {
		url: '/api2/extjs/' + baseurl
	    },
	    listeners: {
		itemdblclick: me.run_editor
	    }
	});

	me.callParent();

	me.on('activate', me.rstore.startUpdate);
	me.on('destroy', me.rstore.stopUpdate);
	me.on('deactivate', me.rstore.stopUpdate);

    }
});


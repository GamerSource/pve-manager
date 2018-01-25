/*jslint confusion: true */
Ext.define('PVE.qemu.Options', {
    extend: 'Proxmox.grid.PendingObjectGrid',
    alias: ['widget.PVE.qemu.Options'],

    onlineHelp: 'qm_options',

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
	    name: {
		required: true,
		defaultValue: me.pveSelNode.data.name,
		header: gettext('Name'),
		editor: caps.vms['VM.Config.Options'] ? {
		    xtype: 'proxmoxWindowEdit',
		    subject: gettext('Name'),
		    items: {
			xtype: 'inputpanel',
			items:{
			    xtype: 'textfield',
			    name: 'name',
			    vtype: 'DnsName',
			    value: '',
			    fieldLabel: gettext('Name'),
			    allowBlank: true
			},
			onGetValues: function(values) {
			    var params = values;
			    if (values.name === undefined ||
				values.name === null ||
				values.name === '') {
				params = { 'delete':'name'};
			    }
			    return params;
			}
		    }
		} : undefined
	    },
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
			deleteDefaultValue: true,
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
			onlineHelp: 'qm_startup_and_shutdown'
		    } : undefined
	    },
	    ostype: {
		header: gettext('OS Type'),
		editor: caps.vms['VM.Config.Options'] ? 'PVE.qemu.OSTypeEdit' : undefined,
		renderer: PVE.Utils.render_kvm_ostype,
		defaultValue: 'other'
	    },
	    bootdisk: {
		visible: false
	    },
	    boot: {
		header: gettext('Boot Order'),
		defaultValue: 'cdn',
		editor: caps.vms['VM.Config.Disk'] ? 'PVE.qemu.BootOrderEdit' : undefined,
		multiKey: ['boot', 'bootdisk'],
		renderer: function(order, metaData, record, rowIndex, colIndex, store, pending) {
		    var i;
		    var text = '';
		    var bootdisk = me.getObjectValue('bootdisk', undefined, pending);
		    order = order || 'cdn';
		    for (i = 0; i < order.length; i++) {
			var sel = order.substring(i, i + 1);
			if (text) {
			    text += ', ';
			}
			if (sel === 'c') {
			    if (bootdisk) {
				text += "Disk '" + bootdisk + "'";
			    } else {
				text += "Disk";
			    }
			} else if (sel === 'n') {
			    text += 'Network';
			} else if (sel === 'a') {
			    text += 'Floppy';
			} else if (sel === 'd') {
			    text += 'CD-ROM';
			} else {
			    text += sel;
			}
		    }
		    return text;
		}
	    },
	    tablet: {
		header: gettext('Use tablet for pointer'),
		defaultValue: true,
		renderer: Proxmox.Utils.format_boolean,
		editor: caps.vms['VM.Config.HWType'] ? {
		    xtype: 'proxmoxWindowEdit',
		    subject: gettext('Use tablet for pointer'),
		    items: {
			xtype: 'proxmoxcheckbox',
			name: 'tablet',
			checked: true,
			uncheckedValue: 0,
			defaultValue: 1,
			deleteDefaultValue: true,
			fieldLabel: gettext('Enabled')
		    }
		} : undefined
	    },
	    hotplug: {
		header: gettext('Hotplug'),
		defaultValue: 'disk,network,usb',
		renderer:  PVE.Utils.render_hotplug_features,
		editor: caps.vms['VM.Config.HWType'] ? {
		    xtype: 'proxmoxWindowEdit',
		    subject: gettext('Hotplug'),
		    items: {
			xtype: 'pveHotplugFeatureSelector',
			name: 'hotplug',
			value: '',
			multiSelect: true,
			fieldLabel: gettext('Hotplug'),
			allowBlank: true
		    }
		} : undefined
	    },
	    acpi: {
		header: gettext('ACPI support'),
		defaultValue: true,
		renderer: Proxmox.Utils.format_boolean,
		editor: caps.vms['VM.Config.HWType'] ? {
		    xtype: 'proxmoxWindowEdit',
		    subject: gettext('ACPI support'),
		    items: {
			xtype: 'proxmoxcheckbox',
			name: 'acpi',
			checked: true,
			uncheckedValue: 0,
			defaultValue: 1,
			deleteDefaultValue: true,
			fieldLabel: gettext('Enabled')
		    }
		} : undefined
	    },
	    scsihw: {
		header: gettext('SCSI Controller'),
		editor: caps.vms['VM.Config.Options'] ? 'PVE.qemu.ScsiHwEdit' : undefined,
		renderer: PVE.Utils.render_scsihw,
		defaultValue: ''
	    },
	    bios: {
		header: 'BIOS',
		editor: caps.vms['VM.Config.Options'] ? 'PVE.qemu.BiosEdit' : undefined,
		renderer: PVE.Utils.render_qemu_bios,
		defaultValue: ''
	    },
	    kvm: {
		header: gettext('KVM hardware virtualization'),
		defaultValue: true,
		renderer: Proxmox.Utils.format_boolean,
		editor: caps.vms['VM.Config.HWType'] ? {
		    xtype: 'proxmoxWindowEdit',
		    subject: gettext('KVM hardware virtualization'),
		    items: {
			xtype: 'proxmoxcheckbox',
			name: 'kvm',
			checked: true,
			uncheckedValue: 0,
			defaultValue: 1,
			deleteDefaultValue: true,
			fieldLabel: gettext('Enabled')
		    }
		} : undefined
	    },
	    freeze: {
		header: gettext('Freeze CPU at startup'),
		defaultValue: false,
		renderer: Proxmox.Utils.format_boolean,
		editor: caps.vms['VM.PowerMgmt'] ? {
		    xtype: 'proxmoxWindowEdit',
		    subject: gettext('Freeze CPU at startup'),
		    items: {
			xtype: 'proxmoxcheckbox',
			name: 'freeze',
			uncheckedValue: 0,
			defaultValue: 0,
			deleteDefaultValue: true,
			labelWidth: 140,
			fieldLabel: gettext('Freeze CPU at startup')
		    }
		} : undefined
	    },
	    localtime: {
		header: gettext('Use local time for RTC'),
		defaultValue: false,
		renderer: Proxmox.Utils.format_boolean,
		editor: caps.vms['VM.Config.Options'] ? {
		    xtype: 'proxmoxWindowEdit',
		    subject: gettext('Use local time for RTC'),
		    items: {
			xtype: 'proxmoxcheckbox',
			name: 'localtime',
			uncheckedValue: 0,
			defaultValue: 0,
			deleteDefaultValue: true,
			labelWidth: 140,
			fieldLabel: gettext('Use local time for RTC')
		    }
		} : undefined
	    },
	    startdate: {
		header: gettext('RTC start date'),
		defaultValue: 'now',
		editor: caps.vms['VM.Config.Options'] ? {
		    xtype: 'proxmoxWindowEdit',
		    subject: gettext('RTC start date'),
		    items: {
			xtype: 'proxmoxtextfield',
			name: 'startdate',
			deleteEmpty: true,
			value: 'now',
			fieldLabel: gettext('RTC start date'),
			vtype: 'QemuStartDate',
			allowBlank: true
		    }
		} : undefined
	    },
	    smbios1: {
		header: gettext('SMBIOS settings (type1)'),
		defaultValue: '',
		renderer: Ext.String.htmlEncode,
		editor: caps.vms['VM.Config.HWType'] ? 'PVE.qemu.Smbios1Edit' : undefined
	    },
	    agent: {
		header: gettext('Qemu Agent'),
		defaultValue: false,
		renderer: Proxmox.Utils.format_boolean,
		editor: caps.vms['VM.Config.Options'] ? {
		    xtype: 'proxmoxWindowEdit',
		    subject: gettext('Qemu Agent'),
		    items: {
			xtype: 'proxmoxcheckbox',
			name: 'agent',
			uncheckedValue: 0,
			defaultValue: 0,
			deleteDefaultValue: true,
			fieldLabel: gettext('Enabled')
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
	    }
	};

	var baseurl = 'nodes/' + nodename + '/qemu/' + vmid + '/config';

	var edit_btn = new Ext.Button({
	    text: gettext('Edit'),
	    disabled: true,
	    handler: me.run_editor
	});

        var revert_btn = new Proxmox.button.Button({
            text: gettext('Revert'),
            disabled: true,
            handler: function() {
		var sm = me.getSelectionModel();
		var rec = sm.getSelection()[0];
		if (!rec) {
		    return;
		}

		var rowdef = me.rows[rec.data.key] || {};
		var keys = rowdef.multiKey ||  [ rec.data.key ];
		var revert = keys.join(',');

                Proxmox.Utils.API2Request({
                    url: '/api2/extjs/' + baseurl,
                    waitMsgTarget: me,
                    method: 'PUT',
                    params: {
                        'revert': revert
                    },
                    callback: function() {
                        me.reload();
                    },
                    failure: function (response, opts) {
                        Ext.Msg.alert('Error',response.htmlStatus);
                    }
                });
            }
        });

	var set_button_status = function() {
	    var sm = me.getSelectionModel();
	    var rec = sm.getSelection()[0];

	    if (!rec) {
		edit_btn.disable();
		return;
	    }

	    var key = rec.data.key;
	    var pending = rec.data['delete'] || me.hasPendingChanges(key);
	    var rowdef = rows[key];

	    edit_btn.setDisabled(!rowdef.editor);
	    revert_btn.setDisabled(!pending);
	};

	Ext.apply(me, {
	    url: "/api2/json/nodes/" + nodename + "/qemu/" + vmid + "/pending",
	    interval: 5000,
	    cwidth1: 250,
	    tbar: [ edit_btn, revert_btn ],
	    rows: rows,
	    editorConfig: {
		url: "/api2/extjs/" + baseurl
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

	me.rstore.on('datachanged', function() {
	    set_button_status();
	});
    }
});


/*jslint confusion: true*/
Ext.define('PVE.qemu.SystemInputPanel', {
    extend: 'Proxmox.panel.InputPanel',
    xtype: 'pveQemuSystemPanel',

    onlineHelp: 'qm_virtual_machines_settings',

    viewModel: {
	data: {
	    efi: false,
	    addefi: true
	},

	formulas: {
	    efidisk: function(get) {
		return get('efi') && get('addefi');
	    }
	}
    },

    onGetValues: function(values) {
	if (values.vga && values.vga.substr(0,6) === 'serial') {
	    values['serial' + values.vga.substr(6,1)] = 'socket';
	}

	var efidrive = {};
	if (values.hdimage) {
	    efidrive.file = values.hdimage;
	} else if (values.hdstorage) {
	    efidrive.file = values.hdstorage + ":1";
	}

	if (values.diskformat) {
	    efidrive.format = values.diskformat;
	}

	delete values.hdimage;
	delete values.hdstorage;
	delete values.diskformat;

	if (efidrive.file) {
	    values.efidisk0 = PVE.Parser.printQemuDrive(efidrive);
	}

	return values;
    },

    controller: {
	xclass: 'Ext.app.ViewController',

	scsihwChange: function(field, value) {
	    var me = this;
	    if (me.getView().insideWizard) {
		me.getViewModel().set('current.scsihw', value);
	    }
	},

	biosChange: function(field, value) {
	    var me = this;
	    if (me.getView().insideWizard) {
		me.getViewModel().set('efi', value === 'ovmf');
	    }
	},

	control: {
	    'pveScsiHwSelector': {
		change: 'scsihwChange'
	    },
	    'pveQemuBiosSelector': {
		change: 'biosChange'
	    }
	}
    },

    column1: [
	{
	    xtype: 'proxmoxKVComboBox',
	    value: '__default__',
	    deleteEmpty: false,
	    fieldLabel: gettext('Graphic card'),
	    name: 'vga',
	    comboItems: PVE.Utils.kvm_vga_driver_array()
	},
	{
	    xtype: 'proxmoxcheckbox',
	    name: 'agent',
	    uncheckedValue: 0,
	    defaultValue: 0,
	    deleteDefaultValue: true,
	    fieldLabel: gettext('Qemu Agent')
	}
    ],

    column2: [
	{
	    xtype: 'pveScsiHwSelector',
	    name: 'scsihw',
	    value: '__default__',
	    bind: {
		value: '{current.scsihw}'
	    },
	    fieldLabel: gettext('SCSI Controller')
	}
    ],

    advancedColumn1: [
	{
	    xtype: 'pveQemuBiosSelector',
	    name: 'bios',
	    value: '__default__',
	    fieldLabel: 'BIOS'
	},
	{
	    xtype: 'proxmoxcheckbox',
	    name: 'eficb',
	    reference: 'eficb',
	    bind: {
		value: '{addefi}',
		hidden: '{!efi}',
		disabled: '{!efi}'
	    },
	    hidden: true,
	    disabled: true,
	    fieldLabel: gettext('Add EFI Disk')
	},
	{
	    xtype: 'pveDiskStorageSelector',
	    name: 'efidisk0',
	    reference: 'efidisk',
	    storageContent: 'images',
	    bind: {
		nodename: '{nodename}',
		hidden: '{!efi}',
		disabled: '{!efidisk}'
	    },
	    autoSelect: false,
	    disabled: true,
	    hidden: true,
	    hideSize: true
	}
    ],

    advancedColumn2: [
	{
	    xtype: 'proxmoxKVComboBox',
	    name: 'machine',
	    value: '__default__',
	    fieldLabel: gettext('Machine'),
	    comboItems: [
		['__default__', PVE.Utils.render_qemu_machine('')],
		['q35', 'q35']
	    ]
	}
    ]

});

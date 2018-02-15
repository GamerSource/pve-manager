Ext.define('PVE.form.FileSelector', {
    extend: 'Proxmox.form.ComboGrid',
    alias: 'widget.pveFileSelector',

    editable: true,
    anyMatch: true,
    forceSelection: true,

    listeners: {
	afterrender: function() {
	    var me = this;
	    if (!me.disabled) {
		me.setStorage(me.storage, me.nodename);
	    }
	}
    },

    setStorage: function(storage, nodename) {
	var me = this;

	var change = false;
	if (storage && (me.storage !== storage)) {
	    me.storage = storage;
	    change = true;
	}

	if (nodename && (me.nodename !== nodename)) {
	    me.nodename = nodename;
	    change = true;
	}

	if (!(me.storage && me.nodename && change)) {
	    return;
	}

	var url = '/api2/json/nodes/' + me.nodename + '/storage/' + me.storage + '/content';
	if (me.storageContent) {
	    url += '?content=' + me.storageContent;
	}

	me.store.setProxy({
	    type: 'proxmox',
	    url: url
	});

	me.store.removeAll();
	me.store.load();
    },

    store: {
	model: 'pve-storage-content'
    },

    allowBlank: false,
    autoSelect: false,
    valueField: 'volid',
    displayField: 'text',

    listConfig: {
	width: 600,
	columns: [
	    {
		header: gettext('Name'),
		dataIndex: 'text',
		hideable: false,
		flex: 1
	    },
	    {
		header: gettext('Format'),
		width: 60,
		dataIndex: 'format'
	    },
	    {
		header: gettext('Size'),
		width: 100,
		dataIndex: 'size',
		renderer: Proxmox.Utils.format_size
	    }
	]
    }
});

Ext.define('PVE.panel.AuthBase', {
    extend: 'Proxmox.panel.InputPanel',
    xtype: 'pveAuthBasePanel',

    type: '',

    onGetValues: function(values) {
	let me = this;

	if (!values.port) {
	    if (!me.isCreate) {
		Proxmox.Utils.assemble_field_data(values, { 'delete': 'port' });
	    }
	    delete values.port;
	}

	if (me.isCreate) {
	    values.type = me.type;
	}

	return values;
    },

    initComponent: function() {
	let me = this;

	if (!me.column1) { me.column1 = []; }
	if (!me.column2) { me.column2 = []; }
	if (!me.columnB) { me.columnB = []; }

	// first field is name
	me.column1.unshift({
	    xtype: me.isCreate ? 'textfield' : 'displayfield',
	    name: 'realm',
	    fieldLabel: gettext('Realm'),
	    value: me.realm,
	    allowBlank: false,
	});

	// last field is default'
	me.column1.push({
	    xtype: 'proxmoxcheckbox',
	    fieldLabel: gettext('Default'),
	    name: 'default',
	    uncheckedValue: 0,
	});

	// last field of column2is tfa
	me.column2.push({
	    xtype: 'pveTFASelector',
	    deleteEmpty: !me.isCreate,
	});

	me.columnB.push({
	    xtype: 'textfield',
	    name: 'comment',
	    fieldLabel: gettext('Comment'),
	});

	me.callParent();
    },
});

Ext.define('PVE.dc.AuthEditBase', {
    extend: 'Proxmox.window.Edit',

    isAdd: true,

    fieldDefaults: {
	labelWidth: 120,
    },

    initComponent: function() {
	var me = this;

	me.isCreate = !me.realm;

	if (me.isCreate) {
	    me.url = '/api2/extjs/access/domains';
	    me.method = 'POST';
	} else {
	    me.url = '/api2/extjs/access/domains/' + me.realm;
	    me.method = 'PUT';
	}

	let authConfig = PVE.Utils.authSchema[me.authType];
	if (!authConfig) {
	    throw 'unknown auth type';
	} else if (!authConfig.add && me.isCreate) {
	    throw 'trying to add non addable realm';
	}

	me.subject = authConfig.name;

	Ext.apply(me, {
	    items: [{
		realm: me.realm,
		xtype: authConfig.ipanel,
		isCreate: me.isCreate,
		type: me.authType,
	    }],
	});

	me.callParent();

	if (!me.isCreate) {
	    me.load({
		success: function(response, options) {
		    var data = response.result.data || {};
		    // just to be sure (should not happen)
		    if (data.type !== me.authType) {
			me.close();
			throw "got wrong auth type";
		    }
		    me.setValues(data);
		},
	    });
	}
    },
});

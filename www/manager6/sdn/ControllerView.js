Ext.define('PVE.sdn.ControllerView', {
    extend: 'Ext.grid.GridPanel',

    alias: ['widget.pveSDNControllerView'],

    stateful: true,
    stateId: 'grid-sdn-controller',

    createSDNControllerEditWindow: function(type, sid) {
	var schema = PVE.Utils.sdncontrollerSchema[type];
	if (!schema || !schema.ipanel) {
	    throw "no editor registered for controller type: " + type;
	}

	Ext.create('PVE.sdn.controllers.BaseEdit', {
	    paneltype: 'PVE.sdn.controllers.' + schema.ipanel,
	    type: type,
	    controllerid: sid,
	    autoShow: true,
	    listeners: {
		destroy: this.reloadStore
	    }
	});
    },

    initComponent : function() {
	var me = this;

	var store = new Ext.data.Store({
	    model: 'pve-sdn-controller',
	    proxy: {
                type: 'proxmox',
		url: "/api2/json/cluster/sdn/controllers"
	    },
	    sorters: {
		property: 'controller',
		order: 'DESC'
	    },
	});

	var reload = function() {
	    store.load();
	};

	var sm = Ext.create('Ext.selection.RowModel', {});

	var run_editor = function() {
	    var rec = sm.getSelection()[0];
	    if (!rec) {
		return;
	    }
	    var type = rec.data.type,
	        controller = rec.data.controller;

	    me.createSDNControllerEditWindow(type, controller);
	};

	var edit_btn = new Proxmox.button.Button({
	    text: gettext('Edit'),
	    disabled: true,
	    selModel: sm,
	    handler: run_editor
	});

	var remove_btn = Ext.create('Proxmox.button.StdRemoveButton', {
	    selModel: sm,
	    baseurl: '/cluster/sdn/controllers/',
	    callback: reload
	});

	// else we cannot dynamically generate the add menu handlers
	var addHandleGenerator = function(type) {
	    return function() { me.createSDNControllerEditWindow(type); };
	};
	var addMenuItems = [], type;
	/*jslint forin: true */

	for (type in PVE.Utils.sdncontrollerSchema) {
	    var controller = PVE.Utils.sdncontrollerSchema[type];
	    if (controller.hideAdd) {
		continue;
	    }
	    addMenuItems.push({
		text:  PVE.Utils.format_sdncontroller_type(type),
		iconCls: 'fa fa-fw fa-' + controller.faIcon,
		handler: addHandleGenerator(type)
	    });
	}

	Ext.apply(me, {
	    store: store,
	    reloadStore: reload,
	    selModel: sm,
	    viewConfig: {
		trackOver: false
	    },
	    tbar: [
		{
		    text: gettext('Add'),
		    menu: new Ext.menu.Menu({
			items: addMenuItems
		    })
		},
		remove_btn,
		edit_btn,
                {
                    text: gettext('Revert'),
                    handler: function() {
                        Proxmox.Utils.API2Request({
                            url: '/cluster/sdn/controllers/',
                            method: 'DELETE',
                            waitMsgTarget: me,
                            callback: function() {
                                reload();
                            },
                            failure: function(response, opts) {
                                Ext.Msg.alert(gettext('Error'), response.htmlStatus);
                            }
                        });
                    }
                },
	    ],
	    columns: [
		{
		    header: 'ID',
		    flex: 2,
		    sortable: true,
		    dataIndex: 'controller'
		},
		{
		    header: gettext('Type'),
		    flex: 1,
		    sortable: true,
		    dataIndex: 'type',
		    renderer: PVE.Utils.format_sdncontroller_type
		},
	    ],
	    listeners: {
		activate: reload,
		itemdblclick: run_editor
	    }
	});

	me.callParent();
    }
});

package PVE::Report;

use strict;
use warnings;
use PVE::pvecfg;
use PVE::Tools;

$ENV{'PATH'} = '/sbin:/bin:/usr/sbin:/usr/bin';

my $cmd_timeout = 10; # generous timeout

# NOTE: always add new sections to the report_order array!
my $report_def = {
    general => {
	title => 'general system info',
	cmds => [
	    'hostname',
	    'pveversion --verbose',
	    'cat /etc/hosts',
	    'top -b -n 1  | head -n 15',
	    'pvesubscription get',
	    'lscpu',
	    'pvesh get /cluster/resources --type node --output-format=yaml',
	],
    },
    storage => [
	'cat /etc/pve/storage.cfg',
	'pvesm status',
	'cat /etc/fstab',
	'findmnt --ascii',
	'df --human',
    ],
    'virtual guests' => [
       'qm list',
       sub { dir2text('/etc/pve/qemu-server/', '\d.*conf') },
       'pct list',
       sub { dir2text('/etc/pve/lxc/', '\d.*conf') },
    ],
    network => [
	'ip -details -statistics address',
	'ip -details -4 route show',
	'ip -details -6 route show',
	'cat /etc/network/interfaces',
    ],
    firewall => [
	sub { dir2text('/etc/pve/firewall/', '.*fw') },
	'cat /etc/pve/local/host.fw',
	'iptables-save',
    ],
    cluster => [
	'pvecm nodes',
	'pvecm status',
	'cat /etc/pve/corosync.conf 2>/dev/null'
    ],
    bios => [
	'dmidecode -t bios',
    ],
    pci => [
	'lspci -nnk',
    ],
    disks => [
	'lsblk --ascii',
	'ls -l /dev/disk/by-*/',
	'iscsiadm -m node',
	'iscsiadm -m session',
    ],
    volumes => [
	'pvs',
	'lvs',
	'vgs',
    ],
};

my @report_order = ('general', 'storage', 'virtual guests', 'network',
'firewall', 'cluster', 'bios', 'pci', 'disks', 'volumes');

push @{$report_def->{volumes}}, 'zpool status', 'zpool list -v', 'zfs list' if cmd_exists('zfs');


if (-e '/etc/ceph/ceph.conf') {
  my $crbd = eval "`ceph osd pool ls | sed -e 's/^/echo /' | sed 'p;s/echo/rbd ls/g'`";

  push @{$report_def->{volumes}}, 'ceph status', 'ceph osd status', 'ceph df', 'pveceph status', 'pveceph lspools', $crbd;
}

push @{$report_def->{disk}}, 'multipath -ll', 'multipath -v3' if cmd_exists('multipath');

my $report = '';

# output the content of all the files of a directory
sub dir2text {
    my ($target_dir, $regexp) = @_;

    PVE::Tools::dir_glob_foreach($target_dir, $regexp, sub {
	my ($file) = @_;
	$report .=  "\n# cat $target_dir$file\n";
	$report .= PVE::Tools::file_get_contents($target_dir.$file)."\n";
    });
}

# command -v is the posix equivalent of 'which'
sub cmd_exists { system("command -v '$_[0]' > /dev/null 2>&1") == 0 }

sub generate {

    my $record_output = sub {
	$report .= shift . "\n";
    };

    my $run_cmd_params = {
	outfunc => $record_output,
	errfunc => $record_output,
	timeout => $cmd_timeout,
	noerr => 1, # avoid checking programs exit code
    };

    foreach my $section (@report_order) {
	my $s = $report_def->{$section};

	my $title = "info about $section";
	my $commands = $s;

	if (ref($s) eq 'HASH') {
	    $commands = $s->{cmds};
	    $title = $s->{title} if defined($s->{title});
	} elsif (ref($s) ne 'ARRAY') {
	    die "unknown report definition in section '$section'!";
	}

	$report .= "\n==== $title ====\n";
	foreach my $command (@$commands) {
	    print STDERR "Process ".$command."...";
	    eval {
		if (ref $command eq 'CODE') {
		    PVE::Tools::run_with_timeout($cmd_timeout, $command);
		} else {
		    $report .= "\n# $command\n";
		    PVE::Tools::run_command($command, %$run_cmd_params);
		}
		print STDERR "OK";
	    };
	    print STDERR "\n";
	    $report .= "\nERROR: $@\n" if $@;
	}
    }

    return $report;
}

1;

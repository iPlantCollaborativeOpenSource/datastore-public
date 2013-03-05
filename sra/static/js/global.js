function rel_path(path) {
	return path.replace(root, "");
}

function file_ext(path) {
	return path.split('.').pop();
}

function display_file_modal(path) {
	
	$('#file-modal')
		.data('path', path)
		.find('h3').text(rel_path(path)).end()
		.find('.modal-body').empty().append($('<p>').append('Loading...')).end()
		.modal();

	var cb = function(data) {
		$('#file-modal .modal-body').html(data);
	};

	if (file_ext(path) == 'txt')
		$.get(base_url(rel_path(path)), cb);
	else
		$.get(base_url('parse_md.php'), {'file': rel_path(path)}, cb);

}

function open_file(path) {
	window.location.replace(base_url(rel_path(path)));
}

$(document).ready( function() {
	
	relative_path = dir.substring(root.length + 1);
	$('#file-tree').fileTree(
		{ 
			root: root, 
			script: base_url('jqueryFileTree.php'),
			dir: relative_path 
		}, 
		function(file) {
			if ((ext = file_ext(file)) == 'md' || ext == 'markdown' || ext == 'txt')
				display_file_modal(file);
			else
				open_file(file);
		}, function (t) {
				$(t).find('li').mouseenter(function() {
					$(t).find('button').hide();
					$(t).find('li:hover > button').last().show();
				});
					
				// copy url button
				$(t).find('li button').show().zclip({
					path: base_url('js/ZeroClipboard.swf'),
					copy: function() {return $(this).prev().attr('href');},
					afterCopy: function() {
						$(t).find('button:disabled').removeAttr('disabled').html('Copy URL');
						$(this).attr('disabled', 'disabled').html('Copied');
					}
				}).attr('style', '');
		});

	$('#file-modal .download-file').click(function(e) {
		e.preventDefault();
		open_file($('#file-modal').data('path'));
		return false;
	});

});

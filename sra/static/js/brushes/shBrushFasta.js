define(['shCore'], function(SyntaxHighlighter) {
    var Brush = function () {
        this.regexList = [
            {regex: /^&gt;(.*)$/gm, css: 'string'},
        ];
    };
    Brush.prototype = new SyntaxHighlighter.Highlighter();
    Brush.aliases = ['fasta'];
    SyntaxHighlighter.brushes.Fasta = Brush;
    return null;
});

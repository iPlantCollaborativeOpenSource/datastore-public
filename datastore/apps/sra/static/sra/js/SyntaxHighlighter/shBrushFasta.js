/* globals SyntaxHighlighter */
;(function() {

    function Brush() {
        this.regexList = [
            { regex: /^&gt;(.*)$/gm, css: 'string' }
        ];
    }

    Brush.prototype = new SyntaxHighlighter.Highlighter();
    Brush.aliases = ['fasta'];

    SyntaxHighlighter.brushes.Fasta = Brush;

    // CommonJS
    typeof(exports) != 'undefined' ? exports.Brush = Brush : null;
})();

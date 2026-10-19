(function (global) {
    function coluna(min, max, qtd) {
        const sorte = new Set();
        while (sorte.size < qtd) sorte.add(min + Math.floor(Math.random() * (max - min + 1)));
        return [...sorte];
    }

    function gerar() {
        const B = coluna(1, 15, 5);
        const I = coluna(16, 30, 5);
        const N = coluna(31, 45, 4);
        const G = coluna(46, 60, 5);
        const O = coluna(61, 75, 5);
        const grid = [];
        for (let linha = 0; linha < 5; linha += 1) {
            const n = linha === 2 ? 0 : N[linha < 2 ? linha : linha - 1];
            grid.push(B[linha], I[linha], n, G[linha], O[linha]);
        }
        return grid;
    }

    function serializar(grid) {
        return grid.join(',');
    }

    function ler(texto) {
        return String(texto || '').split(',').map((n) => Number(n));
    }

    function valida(grid) {
        if (!Array.isArray(grid) || grid.length !== 25 || grid[12] !== 0) return false;
        const faixas = [[1, 15], [16, 30], [31, 45], [46, 60], [61, 75]];
        const vistos = new Set();
        for (let i = 0; i < 25; i += 1) {
            if (i === 12) continue;
            const n = grid[i];
            const [min, max] = faixas[i % 5];
            if (!Number.isInteger(n) || n < min || n > max || vistos.has(n)) return false;
            vistos.add(n);
        }
        return true;
    }

    function temLinha(grid, sorteados) {
        const tem = (n) => n === 0 || sorteados.has(n);
        const grupos = [];
        for (let l = 0; l < 5; l += 1) grupos.push([0, 1, 2, 3, 4].map((c) => l * 5 + c));
        for (let c = 0; c < 5; c += 1) grupos.push([0, 1, 2, 3, 4].map((l) => l * 5 + c));
        grupos.push([0, 6, 12, 18, 24], [4, 8, 12, 16, 20]);
        return grupos.some((grupo) => grupo.every((i) => tem(grid[i])));
    }

    function letra(n) {
        if (n <= 15) return 'B';
        if (n <= 30) return 'I';
        if (n <= 45) return 'N';
        if (n <= 60) return 'G';
        return 'O';
    }

    global.Cartela = { gerar, serializar, ler, valida, temLinha, letra };
})(window);

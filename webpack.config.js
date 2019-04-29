module.exports = {
    mode: 'development',
    entry: './ts/main.ts',
    output: {
        filename: 'main.js',
        path: __dirname,
    },
    module: {
        rules: [
            {test: /\.ts$/, use: 'ts-loader'}
        ]
    },
    resolve: {
        extensions: ['.js', '.ts'],
    }
}
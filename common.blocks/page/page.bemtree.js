block('page').content()(function () {
    return {
        block: 'layout',
        content: [
            {
                block: 'header'
            },
            {
                block: 'body',
                content: {
                    block: 'sandbox'
                }
            }
        ]
    };
});

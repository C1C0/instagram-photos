console.log('fetching');

async function wait() {
    return new Promise((resolve) => {
        setTimeout(() => {
            console.log('finished');
            resolve();
        }, 5000);
    });
}

await wait();
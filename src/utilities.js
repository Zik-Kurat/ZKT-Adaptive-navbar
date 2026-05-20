export async function delay(ms) {
    return new Promise(res => {
        setTimeout(res, ms);
    });
}

/**
 * Функция для запуска CSS анимации с ожиданием её конца.
 * 
 * @param   {HTMLElement} element   - Целевой HTML-элемент
 * @param   {string}      animClass - CSS-класс с анимацией.
 * @param   {number}      [maxTime] - Время гарантированного конца анимации (необязательно).
 * @returns {Promise<void>}
 */
export async function playAnimation(element, animClass, maxTime = 500) {
    // Отсеиваем те анимации, которые были справоцированны добавленным классом.
    // Далее будем ждать конца именно наших анимаций.
    let beforeAnims = element.getAnimations({ subtree: true });
    element.classList.add(animClass);
    let aftetAnims = element.getAnimations({ subtree: true });
    let myAnims = aftetAnims.filter(anim => !beforeAnims.includes(anim));

    if (myAnims.length === 0) {
        element.classList.remove(animClass);
        return;
    }

    await Promise.race([
        Promise.all(myAnims.map(anim => anim.finished)),
        new Promise(res => setTimeout(res, maxTime))
    ]);
    element.classList.remove(animClass);
}

/**
 * Функция связывает передаваемые асинхронные функции, не давая им выполняться одновременно.
 * - Пока выполняется одиа функция, другая, при вызове, будет поставлена в очередь.
 * - Функция может попасть в очередь, только если её там ещё нет. Таким образом очередь не может быть заспамлена.
 * - Функции не получают аргументов и ничего не возвращяют.
 * 
 * @param   {(()=>Promise<void>)[]} funcArray - Массив связываемых функций.
 * @returns {(()=>Promise<void>)[]}             Массив связанных функций.
 */
export function multiLock(funcArray) {
    let isLock = false;
    let runQueue = [];

    let wrappers = [];
    for (const func of funcArray) {
        let wrapper = async () => {
            // Если занято, становимся в очередь.
            if (isLock) {
                // Если мы уже в очереди, то гуляем дальше.
                if (runQueue.find(ticket => ticket.wrapper === wrapper)) return;

                await new Promise(res => {
                    runQueue.push({ wrapper, res });
                });
            };

            isLock = true;
            await func();
            isLock = false;

            // Когда закончили, пригласили следуюшего.
            if (runQueue.length !== 0) {
                let ticket = runQueue.shift();
                ticket.res();
            };
        };

        wrappers.push(wrapper);
    }

    return wrappers;
}

/**
 * Подписка на событие удаления HTML-элемента из DOM-дерева.
 * 
 * @param {HTMLElement} target   - Целевой HTML-элемент.
 * @param {() => void}  callback - Обработчик события.
 */
export function onDeleteNode(target, callback) {
    let observer = new MutationObserver(mutations => {
        for (const mutation of mutations) {
            for (const node of mutation.removedNodes) {
                if (target === node) {
                    callback();
                    observer.disconnect();
                }
            }
        }
    });
    observer.observe(target.parentElement, { childList: true });
}

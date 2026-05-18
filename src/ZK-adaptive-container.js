/**
 * Скрипт adaptiveContainer.
 * Даёт возможность скрыть контент в момент переволнеия контейнера.
 * Даёт возможность проявить скрытый контент в момент появления свободного места.
 * - Когда нужно скрыть лишний контент, вызывается асинхронная функция hide()
 *   (получаемая от пользователя).
 * - Когда свободного места достаточно для показа скрытого контента,
 *   вызывается функция асинхронная show() (получаемая от пользователя).
 * - Для проверки возможности показа скрытого контента используется функция
 *   getShowChange() (получаемая от пользователя). Она возвращает список изменений,
 *   после полной отработки функции show().
 * - Пользователю возвращяется функция для остановки работы скрипта.
 * 
 * Принцип работы скрипта:
 * - С определённой периодичностью (при ресайзе и/или по таймеру) вызывается обработчик.
 * - Обработчик асинхронный. Пока полностью не завершит свою работу, не может быть вызван снова.
 * - Обработчик проверяет контейнер на переполнение. Если таковое есть, вызывается функция hide().
 * - Обработчик проверяет контейнер на возможность вернуть контент. Если таковая есть, вызывается функция show().
 * 
 * Принцип проверки на наличие свободного места:
 * - Для проверки наличия свободного места под скрытый контент, эмулируется его показ.
 *   Функция getShowChange() возвращает конечный список изменений после работы show().
 * - Данные изменения применяются к DOM-элементам, и сразу же производится проверка на
 *   переполнение. Если переполнения нет, считается что есть возможность для вызова
 *   функции show().
 * - Применённые изменения откатываются, и даётся добро на вызов функции show().
 */

/**
 * @typedef {Object} ElemDeltaChange - Список изменений для конкретного HTML-элемента.
 * @property {HTMLElement} elem      - Изменяемый HTML-элемент.
 * @property {string[]}    [add]     - Массив CSS-классов, которые будут добавлены (необязательно).
 * @property {string[]}    [remove]  - Массив CSS-классов, которые будут удалены (необязательно).
*/

import { delay, multiLock } from './utilities.js';



function isOverflow(wrapper) {
    return wrapper.clientWidth < wrapper.scrollWidth;
}
function canShow(wrapper, changeFunc) {
    const changeList = changeFunc();
    if (changeList.length === 0) return false;
    
    for (const change of changeList) {
        let elem = change.elem;

        if (change.add) for (const className of change.add) {
            elem.classList.add(className);
        }
        if (change.remove) for (const className of change.remove) {
            elem.classList.remove(className);
        }
    }

    let result = !isOverflow(wrapper);

    for (const change of changeList) {
        let elem = change.elem;

        if (change.remove) for (const className of change.remove) {
            elem.classList.add(className);
        }
        if (change.add) for (const className of change.add) {
            elem.classList.remove(className);
        }
    }

    return result;
}

/**
 * Инициация адаптивного контейнера.
 * 
 * @param   {HTMLElement}             container     - Контейнер, который будем делать адаптивным.
 * @param   {() => Promise<boolean>}  hide          - Асинхронная функция, для сокрытия лишнего. Если функция возвращает true, значит скрывать нечего. Функция будет временно заблокирована.
 * @param   {() => Promise<void>}     show          - Асинхронная функция, для проявления сокрытого.
 * @param   {() => ElemDeltaChange[]} getShowChange - Синхронная функция, возвращяющая итоговые изменения от show().
 * @returns {() => void}                              Функция для прекращения работы скрипта.
*/
export default function initAdaptiveContainer(container, hide, show, getShowChange) {
    let cancellation = false;
    let hideLock     = false;

    let [hideCheck, showCheck] = multiLock([
        async () => {
            if (hideLock) return;

            while(isOverflow(container)) {
                hideLock = await hide();
                if (hideLock) return;
            }
        },
        async () => {
            while(canShow(container, getShowChange)) {
                hideLock = false;

                await show();
            }
        }
    ]);

    (async()=>{
        while(true) {
            if (cancellation) return;

            await hideCheck();

            await delay(250);
        }
    })();
    (async()=>{
        while(true) {
            if (cancellation) return;

            await showCheck();

            await delay(1000);
        }
    })();

    // Возврат функции для отключения скрипта.
    return () => {
        cancellation = true;
    };
};

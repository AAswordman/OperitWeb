package com.ai.assistance.operit.ui.main.navigation

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelStore
import androidx.lifecycle.ViewModelStoreOwner
import com.ai.assistance.operit.ui.main.screens.Screen

/**
 * 单个路由（AppContent 的 screenKey）的 [ViewModelStoreOwner]。
 *
 * 实例由 [ScreenRouteViewModelStoreOwnerManager] 持有：配置变化期间复用同一
 * 实例（owner 本身不随组合重建），路由真正从导航栈移除时 manager 调用
 * [ViewModelStore.clear]，触发该 store 内所有 ViewModel 的 onCleared 并
 * 取消其 viewModelScope。
 *
 * 与 ViewModelStore 的约定一致：全部操作必须在主线程执行。
 */
class ScreenRouteViewModelStoreOwner internal constructor() : ViewModelStoreOwner {
    override val viewModelStore: ViewModelStore = ViewModelStore()
}

/**
 * 路由级 ViewModelStore 映射（键 = AppContent 的 screenKey）。
 *
 * 本类自身作为 Activity 级 ViewModel 存在（由 AppContent 通过
 * `viewModel()` 获取）：跨配置变化保留全部 owner 与已挂载的 ViewModel；
 * Activity 销毁时 [onCleared] 全清。导航宿主在路由出栈/替换/清栈的
 * 动画完成后调用 [remove] / [retainOnly]，触发对应 owner 的
 * [ViewModelStore.clear]。
 *
 * 必须仅在主线程使用（ViewModelStore 语义）。
 */
class ScreenRouteViewModelStoreOwnerManager : ViewModel() {

    private val owners = mutableMapOf<String, ScreenRouteViewModelStoreOwner>()

    /** 获取（必要时创建）screenKey 的 route owner；配置变化期间复用同一实例。 */
    fun ownerFor(screenKey: String): ScreenRouteViewModelStoreOwner =
        owners.getOrPut(screenKey) { ScreenRouteViewModelStoreOwner() }

    /** 移除并清理 screenKey 的 owner：其 store 内所有 ViewModel 收到 onCleared。 */
    fun remove(screenKey: String) {
        owners.remove(screenKey)?.let { it.viewModelStore.clear() }
    }

    /**
     * 仅保留 [aliveScreenKeys] 中的 owner，其余全部移除并清理。
     * 用于 replace / clear stack 等不经过 back 转场动画的栈变化。
     */
    fun retainOnly(aliveScreenKeys: Set<String>) {
        owners.keys.filter { it !in aliveScreenKeys }.forEach { remove(it) }
    }

    /** 清理全部 owner（Activity 销毁或全新组合时的兜底）。 */
    fun clearAll() {
        owners.values.forEach { it.viewModelStore.clear() }
        owners.clear()
    }

    override fun onCleared() {
        clearAll()
    }
}

/** 路由实例在当前导航栈中对应的 screenKey（与 AppContent 的键规则一致）。 */
fun routeScreenKey(entry: RouteEntry, resolveScreen: (RouteEntry) -> Screen?): String? =
    resolveScreen(entry)?.screenKey(entry.instanceId)

/** 导航栈中仍存活的路由 screenKey 集合（路由级 ViewModelStore 清理依据）。 */
fun screenKeysAliveOnStack(
    stack: List<RouteEntry>,
    resolveScreen: (RouteEntry) -> Screen?,
): Set<String> =
    stack.mapNotNull { routeScreenKey(it, resolveScreen) }.toSet()

/**
 * AppContent 全新组合/重建（配置变化、跨 600dp Phone/Tablet 布局切换等）时
 * 应保留的路由键：当前页 + 导航栈中仍存活的路由。
 *
 * 仅由 AppContent 首次组合（attach，LaunchedEffect(Unit)）调用一次；导航
 * 变化（pop/replace/clear）不得复用本函数，否则会在退出动画完成前清理
 * 仍渲染的离页 owner，其清理由转场完成的 retainOnly(aliveRouteKeys()) 负责。
 *
 * 全新组合时 screenCache/keepAlive 缓存已重置，唯一仍在渲染的只有当前页；
 * 导航栈（Activity 保留的 routerState/manager）仍存活，栈内的 keepAlive
 * 路由键已包含在 [aliveScreenKeys] 中，无需额外补充。离栈的过渡/keepAlive
 * 缓存键由转场完成的 retainOnly(aliveRouteKeys()) 负责清理，与本集合无关。
 */
fun retainedRouteKeysOnContentAttach(
    currentScreenKey: String,
    aliveScreenKeys: Set<String>,
): Set<String> = aliveScreenKeys + currentScreenKey

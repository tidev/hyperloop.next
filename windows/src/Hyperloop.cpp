/**
 * Hyperloop Module
 *
 * Copyright (c) 2016 by Appcelerator, Inc. All Rights Reserved.
 * Licensed under the terms of the Apache Public License.
 * Please see the LICENSE included with this distribution for details.
 */
#include "Hyperloop.hpp"
#include "Titanium/detail/TiImpl.hpp"
#include "TitaniumWindows/LogForwarder.hpp"
#include "TitaniumWindows/Utility.hpp"
#include "Titanium/detail/TiUtil.hpp"

using namespace Windows::UI::Xaml::Interop;
using namespace TitaniumWindows::Utility;
using namespace TitaniumWindows_Hyperloop;
using namespace HyperloopInvocation;

namespace Hyperloop
{
	/*
	 * @class
	 * @discussion
	 *
	 *   Don't remove this class because Windows Store submission process requires
	 *   at least one C++/CX class in winmd. (TIMOB-20192)
	 * 
	 */
	[Windows::Foundation::Metadata::WebHostHidden]
	public ref class HyperloopRef sealed
	{
	public:
		void Run()
		{
			/* DO NOTHING */	
		}
	};
}

HyperloopBase::HyperloopBase(const JSContext& js_context) TITANIUM_NOEXCEPT
	: TitaniumWindows::Platform_Object(js_context)
{
	TITANIUM_LOG_DEBUG("HyperloopBase ctor");
}

void HyperloopBase::JSExportInitialize()
{
	JSExport<HyperloopBase>::SetClassVersion(1);
	JSExport<HyperloopBase>::SetParent(JSExport<Titanium::Module>::Class());
}

HyperloopFunction::HyperloopFunction(const JSContext& js_context) TITANIUM_NOEXCEPT
	: HyperloopBase(js_context)
{
	TITANIUM_LOG_DEBUG("HyperloopFunction ctor");
}

void HyperloopFunction::JSExportInitialize()
{
	JSExport<HyperloopFunction>::SetClassVersion(1);
	JSExport<HyperloopFunction>::SetParent(JSExport<HyperloopBase>::Class());
	JSExport<HyperloopFunction>::AddCallAsFunctionCallback(std::mem_fn(&HyperloopFunction::CallAsFunction));
}

JSValue HyperloopFunction::CallAsFunction(const std::vector<JSValue>& js_arguments, const JSObject& this_object)
{
	TITANIUM_ASSERT(!apiName__.empty());
	TITANIUM_ASSERT(!functionName__.empty());

	const auto argumentCount = js_arguments.size();
	const auto ctx = get_context();

	if (argumentCount == 0) {
		return HyperloopModule::Convert(ctx, Method::GetMethod(type__, ConvertString(functionName__), nullptr)->Invoke(instance__, nullptr));
	} else {
		const auto functionName = ConvertString(functionName__);

		// First, try to get a method with expected parameter types.
		// This could return null when method is not found with given types
		const auto expectedParams = ref new Platform::Array<TypeName>(argumentCount);
		const TypeName nullType;
		for (std::size_t i = 0; i < argumentCount; i++) {
			expectedParams[i] = HyperloopModule::Convert(ctx, js_arguments[i], nullType)->NativeType;
		}

		auto method = Method::GetMethod(type__, functionName, expectedParams);
		if (method == nullptr) {
			// When method is not found with given types, then try to get the method with matched argument count
			// TODO: More precise method overloading detection with derived types etc
			const auto methods = Method::GetMethods(type__, functionName, argumentCount);
			if (methods->Size == 0) {
				detail::ThrowRuntimeError("HyperloopFunction::CallAsFunction", apiName__ + " is not found with the given argument list");
			}
			method = methods->GetAt(0);
		}
		const auto types = method->GetParameters();
		const auto args = ref new Platform::Array<HyperloopInvocation::Instance^>(argumentCount);
		for (std::size_t i = 0; i < argumentCount; i++) {
			args[i] = HyperloopModule::Convert(ctx, js_arguments[i], types[i]);
		}
		try {
			return HyperloopModule::Convert(ctx, method->Invoke(instance__, args));
		} catch (Platform::COMException^ e) {
			TITANIUM_MODULE_LOG_ERROR("HyperloopFunction::CallAsFunction: Failed to call " + apiName__ + " - " + ConvertString(e->Message));
			detail::ThrowRuntimeError("HyperloopFunction::CallAsFunction", "Failed to call " +apiName__);
		}
	}

	return ctx.CreateUndefined();
}

HyperloopInstance::HyperloopInstance(const JSContext& js_context) TITANIUM_NOEXCEPT
	: HyperloopBase(js_context)
	, events(ref new Platform::Collections::Map<Platform::String^, Event^>())
	, tokens(ref new Platform::Collections::Map<Platform::String^, Windows::Foundation::EventRegistrationToken>())
{
	TITANIUM_LOG_DEBUG("HyperloopInstance ctor");
}

HyperloopInstance::~HyperloopInstance()
{
	for (const auto pair : events) {
		pair->Value->GotEvent -= tokens->Lookup(pair->Key);
	}
}

void HyperloopInstance::JSExportInitialize()
{
	JSExport<HyperloopInstance>::SetClassVersion(1);
	JSExport<HyperloopInstance>::SetParent(JSExport<HyperloopBase>::Class());
	JSExport<HyperloopInstance>::AddHasPropertyCallback(std::mem_fn(&HyperloopInstance::HasProperty));
	JSExport<HyperloopInstance>::AddGetPropertyCallback(std::mem_fn(&HyperloopInstance::GetProperty));
	JSExport<HyperloopInstance>::AddSetPropertyCallback(std::mem_fn(&HyperloopInstance::SetProperty));
	TITANIUM_ADD_FUNCTION(HyperloopInstance, addEventListener);
	TITANIUM_ADD_FUNCTION(HyperloopInstance, removeEventListener);
}

TITANIUM_FUNCTION(HyperloopInstance, addEventListener)
{
	ENSURE_STRING_AT_INDEX(eventname, 0);

	const auto name = TitaniumWindows::Utility::ConvertUTF8String(eventname);

	if (!events->HasKey(name))
	{
		const auto evt = static_cast<Event^>(instance__->addEventListener(name, instance__->NativeObject, TypeName(EventHelper::typeid)));
		const auto token = evt->GotEvent += ref new HyperloopEventHandler([this](Event^ evt, Platform::Object^ e) {
			const auto name = TitaniumWindows::Utility::ConvertString(evt->Name);
			const auto type = TitaniumWindows_Hyperloop::TypeHelper::GetType(e->GetType()->FullName);
			const auto object = HyperloopModule::CreateObject(get_context(), ref new HyperloopInvocation::Instance(type, e));

			fireEvent(name, object);
		});
		events->Insert(name, evt);
		tokens->Insert(name, token);
	}

	return Titanium::Module::js_addEventListener(arguments, this_object);
}

TITANIUM_FUNCTION(HyperloopInstance, removeEventListener)
{
	ENSURE_STRING_AT_INDEX(eventname, 0);

	const auto name = TitaniumWindows::Utility::ConvertUTF8String(eventname);
	if (events->HasKey(name)) {
		const auto evt = events->Lookup(name);
		evt->GotEvent -= tokens->Lookup(name);
		instance__->removeEventListener(name, evt, instance__->NativeObject, TypeName(EventHelper::typeid));
		events->Remove(name);
		tokens->Remove(name);
	}

	return Titanium::Module::js_removeEventListener(arguments, this_object);
}

bool HyperloopInstance::HasProperty(const JSString& property_name) const
{
	try {
		if (type__.Name == nullptr) {
			return false;
		}
		const auto name = ConvertUTF8String(property_name);
		return Method::HasMethod(type__, name) || Property::HasProperty(type__, name);
	} catch (...) {
		return false;
	}
}

JSValue HyperloopInstance::GetProperty(const JSString& js_property_name) const
{
	if (type__.Name == nullptr) {
		return get_context().CreateUndefined();
	}
	const std::string property_name = js_property_name;
	const auto rt_name = ConvertUTF8String(property_name);
	const auto apiName = apiName__ + "." + property_name;

	if (Method::HasMethod(type__, rt_name)) {
		// Function
		const auto functionObj = get_context().CreateObject(JSExport<HyperloopFunction>::Class());
		const auto function_ptr = functionObj.GetPrivate<HyperloopFunction>();
		function_ptr->set_functionName(property_name);
		function_ptr->set_apiName(apiName);
		function_ptr->set_instance(instance__);
		function_ptr->set_type(type__);

		return functionObj;
	} else if (Property::HasProperty(type__, rt_name)) {
		// Property
		const auto prop = Property::GetProperty(type__, rt_name);
		return HyperloopModule::Convert(get_context(), prop->GetValue(instance__));
	}

	return get_context().CreateUndefined();
}

bool HyperloopInstance::SetProperty(const JSString& js_property_name, const JSValue& value)
{
	if (type__.Name == nullptr) {
		return false;
	}

	const std::string property_name = js_property_name;
	const auto rt_name = ConvertUTF8String(property_name);
	const auto apiName = apiName__ + "." + property_name;

	if (Method::HasMethod(type__, rt_name)) {
		HAL::detail::ThrowRuntimeError("HyperloopInstance::SetProperty", "Unable to update " + apiName);
	} else if (Property::HasProperty(type__, rt_name)) {
		const auto prop = Property::GetProperty(type__, rt_name);
		const auto expected = prop->GetPropertyType();
		prop->SetValue(instance__, HyperloopModule::Convert(get_context(), value, expected));
		return true;
	}

	return false;
}

void HyperloopInstance::postCallAsConstructor(const JSContext& js_context, const std::vector<JSValue>& js_arguments)
{
	// Restore apiName__ from constructor
	const auto constructor = get_object().GetProperty("constructor");
	TITANIUM_ASSERT(constructor.IsObject());
	const auto hl_ptr = static_cast<JSObject>(constructor).GetPrivate<HyperloopInstance>();
	if (hl_ptr) {
		apiName__ = hl_ptr->get_apiName();
	} else {
		detail::ThrowRuntimeError("HyperloopInstance::postCallAsConstructor", "Can't find Hyperloop object constructor");
	}

	HyperloopBase::postCallAsConstructor(js_context, js_arguments);

	TITANIUM_LOG_DEBUG("HyperloopInstance postCallAsConstructor: ", apiName__);

	try {
		const auto type = TypeHelper::GetType(ConvertUTF8String(apiName__));
		const auto argumentCount = js_arguments.size();
		const auto expectedParams = Instance::GetConstructorParameters(type, argumentCount);

		auto args = ref new Platform::Array<HyperloopInvocation::Instance^>(argumentCount);
		for (std::size_t i = 0; i < argumentCount; i++) {
			TypeName parameterType;
			if (expectedParams->Length > i) {
				parameterType = expectedParams[i];
			}
			args[i] = HyperloopModule::Convert(js_context, js_arguments[i], parameterType);
		}
		set_instance(HyperloopInvocation::Instance::New(type, args));
	} catch (Platform::COMException^ e) {
		detail::ThrowRuntimeError("HyperloopInstance::postCallAsConstructor", ConvertString(e->Message));
	} catch (...) {
		detail::ThrowRuntimeError("HyperloopInstance::postCallAsConstructor", "Unable to instantiate " + apiName__);
	}
}

HyperloopModule::HyperloopModule(const JSContext& js_context) TITANIUM_NOEXCEPT
	: Titanium::Module(js_context, "hyperloop")
{
	TITANIUM_LOG_DEBUG("Hyperloop ctor");
}

void HyperloopModule::JSExportInitialize()
{
	JSExport<HyperloopModule>::SetClassVersion(1);
	JSExport<HyperloopModule>::SetParent(JSExport<Titanium::Module>::Class());
	TITANIUM_ADD_PROPERTY(HyperloopModule, debug);
	TITANIUM_ADD_FUNCTION(HyperloopModule, exists);
	TITANIUM_ADD_FUNCTION(HyperloopModule, require);
}

TITANIUM_PROPERTY_READWRITE(HyperloopModule, bool, debug)
TITANIUM_PROPERTY_SETTER_BOOL(HyperloopModule, debug)
TITANIUM_PROPERTY_GETTER_BOOL(HyperloopModule, debug)

TITANIUM_FUNCTION(HyperloopModule, exists)
{
	ENSURE_STRING_AT_INDEX(moduleId, 0);
	try {
		const auto module = TypeHelper::GetType(ConvertUTF8String(moduleId));
		return get_context().CreateBoolean(module.Name != nullptr);
	} catch (Platform::COMException^ e) {
		if (debug__) {
			detail::ThrowRuntimeError("HyperloopModule::exists", "Unable to find " + moduleId + ": " + TitaniumWindows::Utility::ConvertString(e->Message));
		} else {
			return get_context().CreateBoolean(false);
		}
	} catch (...) {
		TITANIUM_LOG_WARN("Unable to find ", moduleId);
	}
	return get_context().CreateBoolean(false);
}

TITANIUM_FUNCTION(HyperloopModule, require)
{
	ENSURE_STRING_AT_INDEX(moduleId, 0);
	try {
		const auto ctx  = get_context();

		const auto module = TypeHelper::GetType(ConvertUTF8String(moduleId));
		const auto ctor = ctx.CreateObject(JSExport<HyperloopInstance>::Class());
		const auto ctor_ptr = ctor.GetPrivate<HyperloopInstance>();
		ctor_ptr->set_apiName(moduleId);
		ctor_ptr->set_type(module);

		return ctor;
	} catch (Platform::COMException^ e) {
		if (debug__) {
			detail::ThrowRuntimeError("HyperloopModule::require", "Unable to require " + moduleId + ": " + TitaniumWindows::Utility::ConvertString(e->Message));
		} else {
			return get_context().CreateBoolean(false);
		}
	} catch (...) {
		TITANIUM_LOG_WARN("Unable to require ", moduleId);
	}
	return get_context().CreateNull();
}

JSObject HyperloopModule::CreateObject(const JSContext& js_context, HyperloopInvocation::Instance^ instance)
{
	const auto object = js_context.CreateObject(JSExport<HyperloopInstance>::Class());
	const auto object_ptr = object.GetPrivate<HyperloopInstance>();

	object_ptr->set_apiName(TitaniumWindows::Utility::ConvertString(instance->NativeType.Name));
	object_ptr->set_instance(instance);

	return object;
}

// Convert native object to JSValue
JSValue HyperloopModule::Convert(const JSContext& js_context, HyperloopInvocation::Instance^ instance)
{
	if (instance->IsNumber()) {
		return js_context.CreateNumber(instance->ConvertToNumber());
	} else if (instance->IsString()) {
		return js_context.CreateString(ConvertUTF8String(static_cast<Platform::String^>(instance->NativeObject)));
	} else if (instance->IsBoolean()) {
		return js_context.CreateBoolean(static_cast<bool>(instance->NativeObject));
	} else if (instance->IsNull()) {
		return js_context.CreateNull();
	} else if (instance->IsObject()) {
		return CreateObject(js_context, instance);
	} else {
		Titanium::detail::ThrowRuntimeError("HyperloopModule::Convert", "Can't convert native type: " + ConvertString(instance->NativeType.Name));
	}

	return js_context.CreateUndefined();
}

HyperloopInvocation::Instance^ HyperloopModule::Convert(const JSContext& js_context, const JSValue& value, const TypeName expected)
{	
	if (value.IsBoolean()) {
		return ref new HyperloopInvocation::Instance(TypeName(bool::typeid), static_cast<bool>(value));
	} else if (value.IsNumber()) {
		// When you have a clue about expected type
		if (expected.Name != nullptr) {
			return ref new HyperloopInvocation::Instance(expected, Instance::Convert(expected, static_cast<double>(value)));
		}
		return ref new HyperloopInvocation::Instance(TypeName(double::typeid), static_cast<double>(value));
	} else if (value.IsString()) {
		return ref new HyperloopInvocation::Instance(TypeName(Platform::String::typeid), ConvertUTF8String(static_cast<std::string>(value)));
	} else if (value.IsNull() || value.IsUndefined()) {
		TypeName t;
		return ref new HyperloopInvocation::Instance(t, nullptr);
	} else if (value.IsObject()) {
		const auto instance_ptr = static_cast<JSObject>(value).GetPrivate<HyperloopInstance>();
		if (instance_ptr) {
			// Hyperloop Object (native object)
			return instance_ptr->get_instance();
		} else {
			const auto titanium_ptr = static_cast<JSObject>(value).GetPrivate<Titanium::Module>();
			if (titanium_ptr) {
				// TODO: Titanium Object
				detail::ThrowRuntimeError("HyperloopInstance::postCallAsConstructor", "Unsupported object type (Titanium)");
			} else {
				// TODO: Plain JavaScript Object
				detail::ThrowRuntimeError("HyperloopInstance::postCallAsConstructor", "Unsupported object type (JavaScript)");
			}
		}
	}
	return nullptr;
}

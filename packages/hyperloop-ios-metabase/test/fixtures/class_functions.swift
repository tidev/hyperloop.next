import UIKit
import Foundation

public class MyUI : UIView {

	public func makeRect (width : CGFloat, height : CGFloat) -> CGRect {
		return CGRect(x: 0, y: 0, width: width, height: height)
	}

	public static func add (x : CGFloat) -> CGFloat {
		return x + 1
	}
}
